import re
import secrets
from datetime import datetime, timedelta

from app.db.repository.userRepo import UserRepository
from app.db.schema.user import UserOutput, UserInCreate, UserInLogin, UserWithToken
from app.core.mailer import Mailer, RESET_CODE_TTL_MINUTES
from app.core.security.hashHelper import HashHelper
from app.core.security.authHandler import AuthHandler
from app.core.security.googleVerifier import GoogleVerifier
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

MAX_RESET_CODE_ATTEMPTS = 5


class UserService:
    def __init__(self, session: Session):
        self.__userRepository = UserRepository(session=session)

    def signup(self, user_details: UserInCreate) -> UserOutput:
        user_details.email = user_details.email.lower()

        if self.__userRepository.user_exist_by_email(email=user_details.email):
            raise HTTPException(status_code=400, detail="Please Login")
        if self.__userRepository.user_exist_by_username(username=user_details.username):
            raise HTTPException(status_code=400, detail="Username already taken")

        password_hash = HashHelper.get_password_hash(plain_password=user_details.password)
        return self.__userRepository.create_user(user_data=user_details, password_hash=password_hash)

    def login(self, login_details: UserInLogin) -> UserWithToken:
        login_details.email = login_details.email.lower()

        if not self.__userRepository.user_exist_by_email(email=login_details.email):
            raise HTTPException(status_code=400, detail="Please create an Account")

        user = self.__userRepository.get_user_by_email(email=login_details.email)
        if HashHelper.verify_password(plain_password=login_details.password, hashed_password=user.password_hash):
            return self._issue_tokens(user.id)
        raise HTTPException(status_code=400, detail="Please check your Credentials")

    def forgot_password(self, email: str, background_tasks) -> dict:
        """Issue a 6-digit reset code and email it.

        Always answers the same way regardless of whether the account exists,
        so the endpoint can't be used to probe registered emails.
        """
        if not Mailer.is_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Password reset emails are not configured on the server")

        email = email.lower()
        user = self.__userRepository.get_user_by_email(email=email)
        if user:
            code = f"{secrets.randbelow(1_000_000):06d}"
            self.__userRepository.set_reset_code(
                user=user,
                code_hash=HashHelper.get_password_hash(plain_password=code),
                expires_at=datetime.utcnow() + timedelta(minutes=RESET_CODE_TTL_MINUTES),
            )
            # Send after the response so timing doesn't reveal whether the
            # email is registered (SMTP roundtrip takes noticeable time).
            background_tasks.add_task(Mailer.send_reset_code, email, code)
        return {"detail": "If this email is registered, a reset code has been sent"}

    def reset_password(self, email: str, code: str, new_password: str) -> dict:
        """Validate the emailed code and set the new password."""
        generic = HTTPException(status_code=400, detail="Invalid or expired code")

        user = self.__userRepository.get_user_by_email(email=email.lower())
        if not user or not user.reset_code_hash or not user.reset_code_expires_at:
            raise generic
        if user.reset_code_expires_at < datetime.utcnow():
            raise generic
        if (user.reset_code_attempts or 0) >= MAX_RESET_CODE_ATTEMPTS:
            raise generic
        if not HashHelper.verify_password(plain_password=code,
                                          hashed_password=user.reset_code_hash):
            self.__userRepository.bump_reset_attempts(user=user)
            raise generic

        self.__userRepository.set_password_and_clear_reset_code(
            user=user,
            password_hash=HashHelper.get_password_hash(plain_password=new_password),
        )
        return {"detail": "Password has been reset"}

    def login_with_google(self, id_token: str) -> UserWithToken:
        """Sign in / sign up with a verified Google ID token.

        Resolution order:
        1. account already linked (google_sub matches) -> log in;
        2. account with the same (Google-verified) email -> link it and log in;
        3. otherwise create a fresh account.
        """
        claims = GoogleVerifier.verify(id_token)
        google_sub = claims["sub"]
        email = claims["email"].lower()

        user = self.__userRepository.get_user_by_google_sub(google_sub=google_sub)
        if user:
            return self._issue_tokens(user.id)

        # Google-managed accounts get a random unusable password; the user can
        # set a real one later via PATCH /me.
        placeholder_hash = HashHelper.get_password_hash(
            plain_password=secrets.token_urlsafe(32))

        user = self.__userRepository.get_user_by_email(email=email)
        if user:
            # Our signup never verifies emails, so a password set on this
            # address may belong to someone who pre-registered it. Google DID
            # verify ownership — link and invalidate the old password.
            self.__userRepository.link_google_account(
                user=user, google_sub=google_sub, password_hash=placeholder_hash)
            return self._issue_tokens(user.id)

        user = self.__userRepository.create_google_user(
            username=self._unique_username_from_email(email=email),
            email=email,
            google_sub=google_sub,
            password_hash=placeholder_hash,
            first_name=(claims.get("given_name") or "")[:50] or None,
            last_name=(claims.get("family_name") or "")[:100] or None,
        )
        return self._issue_tokens(user.id)

    def _unique_username_from_email(self, email: str) -> str:
        base = re.sub(r"[^a-z0-9._-]", "", email.split("@")[0].lower())[:40]
        if len(base) < 3:
            base = f"user{base}"
        candidate, attempt = base, 1
        while self.__userRepository.user_exist_by_username(username=candidate):
            attempt += 1
            candidate = f"{base}{attempt}"
        return candidate

    def _issue_tokens(self, user_id: int) -> UserWithToken:
        return UserWithToken(
            token=AuthHandler.sign_access_token(user_id=user_id),
            refresh_token=AuthHandler.sign_refresh_token(user_id=user_id),
        )

    def refresh(self, refresh_token: str) -> UserWithToken:
        """Exchange a valid refresh token for a fresh access token (stateless).
        The same refresh token keeps working until it expires on its own."""
        payload = AuthHandler.decode_refresh(refresh_token)
        if not payload or "user_id" not in payload:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid or expired refresh token")
        # Make sure the account still exists before minting a new access token.
        self.get_user_by_id(payload["user_id"])
        return UserWithToken(
            token=AuthHandler.sign_access_token(user_id=payload["user_id"]),
            refresh_token=refresh_token,
        )

    def get_user_by_id(self, user_id: int):
        user = self.__userRepository.get_user_by_id(user_id=user_id)
        if user:
            return user
        raise HTTPException(status_code=400, detail="User is not available")

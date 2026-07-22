import re
import secrets
from datetime import datetime, timedelta

from app.db.repository.userRepo import UserRepository
from app.db.schema.user import UserOutput, UserInCreate, UserInLogin, UserWithToken
from app.core.mailer import Mailer, CODE_TTL_MINUTES
from app.core.security.hashHelper import HashHelper
from app.core.security.authHandler import AuthHandler
from app.core.security.googleVerifier import GoogleVerifier
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.core.legal import CONSENT_REQUIRED_MESSAGE

MAX_CODE_ATTEMPTS = 5


class UserService:
    def __init__(self, session: Session):
        self.__userRepository = UserRepository(session=session)

    @staticmethod
    def _verification_required() -> bool:
        """Email confirmation is enforced only when SMTP is configured.
        Without credentials nobody could ever receive a code, so requiring it
        would lock every new user out (dev/test setups run without SMTP)."""
        return Mailer.is_configured()

    def signup(self, user_details: UserInCreate, background_tasks=None) -> UserOutput:
        self._require_consents(
            user_details.terms_accepted, user_details.privacy_accepted)
        user_details.email = user_details.email.lower()
        password_hash = HashHelper.get_password_hash(plain_password=user_details.password)

        existing = self.__userRepository.get_user_by_email(email=user_details.email)
        if existing:
            if existing.email_verified or not self._verification_required():
                raise HTTPException(status_code=400, detail="Please Login")
            # The email was registered but never confirmed — whoever signed up
            # didn't prove ownership, so this attempt takes the account over.
            username_owner = self.__userRepository.get_user_by_username(
                username=user_details.username)
            if username_owner and username_owner.id != existing.id:
                raise HTTPException(status_code=400, detail="Username already taken")
            user = self.__userRepository.update_unverified_signup(
                user=existing, user_data=user_details, password_hash=password_hash)
        else:
            if self.__userRepository.user_exist_by_username(username=user_details.username):
                raise HTTPException(status_code=400, detail="Username already taken")
            user = self.__userRepository.create_user(
                user_data=user_details,
                password_hash=password_hash,
                email_verified=not self._verification_required(),
            )

        if self._verification_required():
            self._send_verification_code(user=user, background_tasks=background_tasks)
        return user

    def _email_one_time_code(self, user, kind: str, send, background_tasks=None) -> None:
        """Issue a fresh 6-digit code into the {kind}_code_* columns and email
        it via `send` (a Mailer.send_* callable). When background_tasks is
        given, the email goes out after the response — SMTP roundtrip timing
        must not reveal whether the address is registered."""
        code = f"{secrets.randbelow(1_000_000):06d}"
        self.__userRepository.set_one_time_code(
            user=user, kind=kind,
            code_hash=HashHelper.get_password_hash(plain_password=code),
            expires_at=datetime.utcnow() + timedelta(minutes=CODE_TTL_MINUTES),
        )
        if background_tasks is not None:
            background_tasks.add_task(send, user.email, code)
        else:
            send(user.email, code)

    def _require_valid_code(self, user, code: str, kind: str) -> None:
        """Shared guard for emailed one-time codes ({kind}_code_* columns):
        presence, expiry, attempt cap, bcrypt match. Every failure raises the
        same generic 400 so the response doesn't hint at which check failed."""
        generic = HTTPException(status_code=400, detail="Invalid or expired code")
        code_hash = getattr(user, f"{kind}_code_hash")
        expires_at = getattr(user, f"{kind}_code_expires_at")
        if not code_hash or not expires_at or expires_at < datetime.utcnow():
            raise generic
        if (getattr(user, f"{kind}_code_attempts") or 0) >= MAX_CODE_ATTEMPTS:
            raise generic
        if not HashHelper.verify_password(plain_password=code, hashed_password=code_hash):
            self.__userRepository.bump_code_attempts(user=user, kind=kind)
            raise generic

    def _send_verification_code(self, user, background_tasks=None) -> None:
        self._email_one_time_code(user=user, kind="verify",
                                  send=Mailer.send_verification_code,
                                  background_tasks=background_tasks)

    def verify_email(self, email: str, code: str) -> UserWithToken:
        """Confirm the address with the emailed code; log the user in on success."""
        user = self.__userRepository.get_user_by_email(email=email.lower())
        if not user or user.email_verified:
            raise HTTPException(status_code=400, detail="Invalid or expired code")
        self._require_valid_code(user=user, code=code, kind="verify")

        self.__userRepository.mark_email_verified(user=user)
        return self._issue_tokens(user.id)

    def resend_verification(self, email: str, background_tasks) -> dict:
        """Send a fresh verification code. Same generic answer whether or not
        the account exists, so the endpoint can't probe registered emails."""
        user = self.__userRepository.get_user_by_email(email=email.lower())
        if user and not user.email_verified and self._verification_required():
            self._send_verification_code(user=user, background_tasks=background_tasks)
        return {"detail": "If this email is registered, a verification code has been sent"}

    def login(self, login_details: UserInLogin) -> UserWithToken:
        login_details.email = login_details.email.lower()

        if not self.__userRepository.user_exist_by_email(email=login_details.email):
            raise HTTPException(status_code=400, detail="Please create an Account")

        user = self.__userRepository.get_user_by_email(email=login_details.email)
        if HashHelper.verify_password(plain_password=login_details.password, hashed_password=user.password_hash):
            if not user.email_verified and self._verification_required():
                raise HTTPException(status_code=403, detail="Email not verified")
            return self._issue_tokens(user.id)
        raise HTTPException(status_code=400, detail="Please check your Credentials")

    def forgot_password(self, email: str, background_tasks) -> dict:
        """Issue a 6-digit reset code and email it.

        Always answers the same way regardless of whether the account exists,
        so the endpoint can't be used to probe registered emails.

        With empty SMTP credentials (dev) the code is not emailed — the
        Mailer logs it on the server instead, so the flow stays testable.
        """
        user = self.__userRepository.get_user_by_email(email=email.lower())
        if user:
            self._email_one_time_code(user=user, kind="reset",
                                      send=Mailer.send_reset_code,
                                      background_tasks=background_tasks)
        return {"detail": "If this email is registered, a reset code has been sent"}

    def reset_password(self, email: str, code: str, new_password: str) -> dict:
        """Validate the emailed code and set the new password."""
        user = self.__userRepository.get_user_by_email(email=email.lower())
        if not user:
            raise HTTPException(status_code=400, detail="Invalid or expired code")
        self._require_valid_code(user=user, code=code, kind="reset")

        self.__userRepository.set_password_and_clear_reset_code(
            user=user,
            password_hash=HashHelper.get_password_hash(plain_password=new_password),
        )
        return {"detail": "Password has been reset"}

    @staticmethod
    def _require_consents(terms_accepted, privacy_accepted) -> None:
        if terms_accepted is not True or privacy_accepted is not True:
            raise HTTPException(status_code=400, detail=CONSENT_REQUIRED_MESSAGE)

    def login_with_google(self, id_token: str, terms_accepted=None,
                          privacy_accepted=None) -> UserWithToken:
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
            # A password account on this address may predate email
            # verification (or SMTP was off at signup), so its owner never
            # proved address ownership. Google DID verify it — link and
            # invalidate the old password.
            self.__userRepository.link_google_account(
                user=user, google_sub=google_sub, password_hash=placeholder_hash)
            return self._issue_tokens(user.id)

        self._require_consents(terms_accepted, privacy_accepted)

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

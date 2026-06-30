from app.db.repository.userRepo import UserRepository
from app.db.schema.user import UserOutput, UserInCreate, UserInLogin, UserWithToken
from app.core.security.hashHelper import HashHelper
from app.core.security.authHandler import AuthHandler
from sqlalchemy.orm import Session
from fastapi import HTTPException, status


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

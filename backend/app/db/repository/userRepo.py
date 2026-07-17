from .base import BaseRepository
from app.db.models.user import User
from app.db.schema.user import UserInCreate

class UserRepository(BaseRepository):
    def create_user(self, user_data: UserInCreate, password_hash: str,
                    email_verified: bool = True) -> User:
        newUser = User(
            username=user_data.username,
            email=user_data.email,
            password_hash=password_hash,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            email_verified=email_verified,
        )

        self.session.add(instance=newUser)
        self.session.commit()
        self.session.refresh(instance=newUser)

        return newUser

    def update_unverified_signup(self, user: User, user_data: UserInCreate,
                                 password_hash: str) -> User:
        # The previous registration never proved it owns this address, so a
        # new signup attempt takes the account over (fresh credentials).
        user.username = user_data.username
        user.password_hash = password_hash
        user.first_name = user_data.first_name
        user.last_name = user_data.last_name
        self.session.commit()
        self.session.refresh(instance=user)
        return user

    def user_exist_by_email(self, email: str) -> bool:
        user = self.session.query(User).filter_by(email=email).first()
        return bool(user)

    def user_exist_by_username(self, username: str) -> bool:
        user = self.session.query(User).filter_by(username=username).first()
        return bool(user)

    def create_google_user(self, username: str, email: str, google_sub: str,
                           password_hash: str, first_name: str = None,
                           last_name: str = None) -> User:
        newUser = User(
            username=username,
            email=email,
            password_hash=password_hash,
            google_sub=google_sub,
            first_name=first_name,
            last_name=last_name,
            # Google already verified ownership of this address.
            email_verified=True,
        )

        self.session.add(instance=newUser)
        self.session.commit()
        self.session.refresh(instance=newUser)

        return newUser

    def link_google_account(self, user: User, google_sub: str,
                            password_hash: str = None) -> User:
        user.google_sub = google_sub
        if password_hash is not None:
            user.password_hash = password_hash
        user.email_verified = True
        user.verify_code_hash = None
        user.verify_code_expires_at = None
        user.verify_code_attempts = 0
        self.session.commit()
        self.session.refresh(instance=user)
        return user

    def set_verify_code(self, user: User, code_hash: str, expires_at) -> None:
        user.verify_code_hash = code_hash
        user.verify_code_expires_at = expires_at
        user.verify_code_attempts = 0
        self.session.commit()

    def bump_verify_attempts(self, user: User) -> None:
        user.verify_code_attempts = (user.verify_code_attempts or 0) + 1
        self.session.commit()

    def mark_email_verified(self, user: User) -> None:
        user.email_verified = True
        user.verify_code_hash = None
        user.verify_code_expires_at = None
        user.verify_code_attempts = 0
        self.session.commit()

    def set_reset_code(self, user: User, code_hash: str, expires_at) -> None:
        user.reset_code_hash = code_hash
        user.reset_code_expires_at = expires_at
        user.reset_code_attempts = 0
        self.session.commit()

    def bump_reset_attempts(self, user: User) -> None:
        user.reset_code_attempts = (user.reset_code_attempts or 0) + 1
        self.session.commit()

    def set_password_and_clear_reset_code(self, user: User, password_hash: str) -> None:
        user.password_hash = password_hash
        user.reset_code_hash = None
        user.reset_code_expires_at = None
        user.reset_code_attempts = 0
        self.session.commit()

    def get_user_by_google_sub(self, google_sub: str) -> User:
        user = self.session.query(User).filter_by(google_sub=google_sub).first()
        return user

    def get_user_by_username(self, username: str) -> User:
        user = self.session.query(User).filter_by(username=username).first()
        return user

    def get_user_by_email(self, email: str) -> User:
        user = self.session.query(User).filter_by(email=email).first()
        return user

    def get_user_by_id(self, user_id : int) -> User:
        user = self.session.query(User).filter_by(id=user_id).first()
        return user

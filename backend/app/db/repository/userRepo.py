from .base import BaseRepository
from app.db.models.user import User
from app.db.schema.user import UserInCreate

class UserRepository(BaseRepository):
    def create_user(self, user_data: UserInCreate, password_hash: str) -> User:
        newUser = User(
            username=user_data.username,
            email=user_data.email,
            password_hash=password_hash,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
        )

        self.session.add(instance=newUser)
        self.session.commit()
        self.session.refresh(instance=newUser)

        return newUser

    def user_exist_by_email(self, email: str) -> bool:
        user = self.session.query(User).filter_by(email=email).first()
        return bool(user)

    def user_exist_by_username(self, username: str) -> bool:
        user = self.session.query(User).filter_by(username=username).first()
        return bool(user)

    def get_user_by_email(self, email: str) -> User:
        user = self.session.query(User).filter_by(email=email).first()
        return user

    def get_user_by_id(self, user_id : int) -> User:
        user = self.session.query(User).filter_by(id=user_id).first()
        return user

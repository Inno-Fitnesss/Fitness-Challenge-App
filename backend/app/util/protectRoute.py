from datetime import datetime, timedelta

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from typing import Annotated, Union
from app.core.security.authHandler import AuthHandler
from app.service.userService import UserService
from app.core.database import get_db
from app.db.schema.user import UserOutput

AUTH_PREFIX = 'Bearer '

# How often (at most) an authenticated request refreshes users.last_seen_at.
# Coarse on purpose: the admin panel only needs day-level resolution for
# DAU/WAU/MAU, and this keeps it to a handful of writes per active user per day.
LAST_SEEN_REFRESH = timedelta(minutes=10)


def _touch_last_seen(session: Session, user) -> None:
    """Best-effort activity mark; must never fail the actual request."""
    now = datetime.utcnow()
    if user.last_seen_at is not None and now - user.last_seen_at < LAST_SEEN_REFRESH:
        return
    try:
        user.last_seen_at = now
        session.commit()
    except Exception:
        session.rollback()


def get_current_user(
        session: Session = Depends(get_db),
        authorization: Annotated[Union[str, None], Header()] = None
) -> UserOutput:
    auth_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid Authentication Credentials"
    )

    if not authorization:
        raise auth_exception

    if not authorization.startswith(AUTH_PREFIX):
        raise auth_exception

    payload = AuthHandler.decode_jwt(token=authorization[len(AUTH_PREFIX):])

    if payload and payload["user_id"]:
        try:
            user = UserService(session=session).get_user_by_id(payload["user_id"])
            _touch_last_seen(session=session, user=user)
            return UserOutput(
                id=user.id,
                username=user.username,
                first_name=user.first_name,
                last_name=user.last_name,
                email=user.email
            )
        except Exception as error:
            raise error
    raise auth_exception

def get_current_admin(
        authorization: Annotated[Union[str, None], Header()] = None
) -> bool:
    """Gate for /admin/* routes. Checks a short-lived admin session token —
    unrelated to regular user accounts, since access is by shared password."""
    auth_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid Admin Session"
    )

    if not authorization or not authorization.startswith(AUTH_PREFIX):
        raise auth_exception

    payload = AuthHandler.decode_admin_token(token=authorization[len(AUTH_PREFIX):])
    if not payload:
        raise auth_exception

    return True
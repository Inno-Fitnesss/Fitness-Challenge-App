import time

import jwt
from decouple import config

JWT_SECRET = config("JWT_SECRET")
JWT_ALGORITHM = config("JWT_ALGORITHM")

# Short-lived access token + long-lived refresh token (stateless).
ACCESS_TTL = config("ACCESS_TTL_SECONDS", default=1800, cast=int)        # 30 min
REFRESH_TTL = config("REFRESH_TTL_SECONDS", default=1209600, cast=int)   # 14 days
ADMIN_TTL = config("ADMIN_TTL_SECONDS", default=7200, cast=int)


class AuthHandler(object):

    @staticmethod
    def _sign(user_id: int, token_type: str, ttl: int) -> str:
        now = int(time.time())
        payload = {
            "user_id": user_id,
            "type": token_type,
            "iat": now,
            "exp": now + ttl,
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    @staticmethod
    def sign_access_token(user_id: int) -> str:
        return AuthHandler._sign(user_id, "access", ACCESS_TTL)

    @staticmethod
    def sign_refresh_token(user_id: int) -> str:
        return AuthHandler._sign(user_id, "refresh", REFRESH_TTL)

    # Backwards-compatible alias: existing callers that just want a usable token.
    @staticmethod
    def sign_jwt(user_id: int) -> str:
        return AuthHandler.sign_access_token(user_id)

    @staticmethod
    def _decode(token: str, expected_type: str) -> dict | None:
        try:
            decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except Exception:
            return None
        # `exp` is validated by jwt.decode; here we also pin the token kind so an
        # access token can't be used to refresh and a refresh token can't be used
        # as a bearer credential on protected routes.
        if decoded.get("type") != expected_type:
            return None
        return decoded

    @staticmethod
    def decode_jwt(token: str) -> dict | None:
        """Validate an ACCESS token (used by protected routes)."""
        return AuthHandler._decode(token, "access")

    @staticmethod
    def decode_refresh(token: str) -> dict | None:
        """Validate a REFRESH token (used by /auth/refresh)."""
        return AuthHandler._decode(token, "refresh")
    
    # --- Admin panel tokens -------------------------------------------------
    # Separate token kind so an admin session can never be forged from (or
    # confused with) a regular user's access/refresh token. Not tied to a
    # user_id — the admin panel is gated by a single shared password.
    @staticmethod
    def sign_admin_token() -> str:
        now = int(time.time())
        payload = {
            "type": "admin",
            "iat": now,
            "exp": now + ADMIN_TTL,
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    @staticmethod
    def decode_admin_token(token: str) -> dict | None:
        try:
            decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except Exception:
            return None
        if decoded.get("type") != "admin":
            return None
        return decoded

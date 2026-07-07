from decouple import config
from fastapi import HTTPException, status

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

GOOGLE_CLIENT_ID = config("GOOGLE_CLIENT_ID", default=None)


class GoogleVerifier:
    """Validates Google ID tokens obtained by the frontend via
    "Sign in with Google" (Google Identity Services)."""

    @staticmethod
    def verify(token: str) -> dict:
        """Return the verified token claims (sub, email, given_name, ...).

        Raises HTTPException on any failure so callers can pass it through.
        """
        if not GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google login is not configured on the server",
            )
        try:
            # Validates signature (against Google's published certs), expiry,
            # issuer and that the token was issued to OUR client id (aud).
            claims = google_id_token.verify_oauth2_token(
                token, google_requests.Request(), GOOGLE_CLIENT_ID
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google token",
            )
        # Only trust verified addresses: account auto-linking below relies on
        # Google having confirmed ownership of the email.
        if not claims.get("sub") or not claims.get("email") or not claims.get("email_verified"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google account email is not verified",
            )
        return claims

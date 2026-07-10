from datetime import date, datetime, timedelta

import httpx
from decouple import config

WITHINGS_CLIENT_ID = config("WITHINGS_CLIENT_ID", default="")
WITHINGS_CLIENT_SECRET = config("WITHINGS_CLIENT_SECRET", default="")
WITHINGS_REDIRECT_URI = config("WITHINGS_REDIRECT_URI", default="")

AUTHORIZE_BASE = "https://account.withings.com/oauth2_user/authorize2"
OAUTH_ENDPOINT = "https://wbsapi.withings.net/v2/oauth2"
MEASURE_ENDPOINT = "https://wbsapi.withings.net/v2/measure"


class WithingsError(Exception):
    pass


class WithingsService:
    """Withings' OAuth2 is slightly non-standard: token exchange/refresh both
    go through the same `/v2/oauth2` endpoint with an `action` field in the
    body, instead of a plain RFC-6749 token endpoint. Everything else is
    fairly standard OAuth2 + a simple REST activity API."""

    @staticmethod
    def build_authorize_url(state: str) -> str:
        params = (
            f"?response_type=code"
            f"&client_id={WITHINGS_CLIENT_ID}"
            f"&scope=user.activity"
            f"&redirect_uri={WITHINGS_REDIRECT_URI}"
            f"&state={state}"
        )
        return AUTHORIZE_BASE + params

    @staticmethod
    def exchange_code(code: str) -> dict:
        """Trades an authorization code for an access/refresh token pair.
        Returns the raw `body` dict from Withings: userid, access_token,
        refresh_token, expires_in (seconds)."""
        resp = httpx.post(OAUTH_ENDPOINT, data={
            "action": "requesttoken",
            "grant_type": "authorization_code",
            "client_id": WITHINGS_CLIENT_ID,
            "client_secret": WITHINGS_CLIENT_SECRET,
            "code": code,
            "redirect_uri": WITHINGS_REDIRECT_URI,
        })
        data = resp.json()
        if data.get("status") != 0:
            raise WithingsError(f"Withings token exchange failed: {data}")
        return data["body"]

    @staticmethod
    def refresh_token(refresh_token: str) -> dict:
        resp = httpx.post(OAUTH_ENDPOINT, data={
            "action": "requesttoken",
            "grant_type": "refresh_token",
            "client_id": WITHINGS_CLIENT_ID,
            "client_secret": WITHINGS_CLIENT_SECRET,
            "refresh_token": refresh_token,
        })
        data = resp.json()
        if data.get("status") != 0:
            raise WithingsError(f"Withings token refresh failed: {data}")
        return data["body"]

    @staticmethod
    def fetch_daily_steps(access_token: str, start: date, end: date) -> dict[date, int]:
        """Returns {date: step_count} for the given inclusive range."""
        resp = httpx.post(
            MEASURE_ENDPOINT,
            headers={"Authorization": f"Bearer {access_token}"},
            data={
                "action": "getactivity",
                "startdateymd": start.isoformat(),
                "enddateymd": end.isoformat(),
                "data_fields": "steps",
            },
        )
        data = resp.json()
        if data.get("status") != 0:
            raise WithingsError(f"Withings getactivity failed: {data}")

        result: dict[date, int] = {}
        for activity in data["body"].get("activities", []):
            day = datetime.strptime(activity["date"], "%Y-%m-%d").date()
            result[day] = activity.get("steps", 0)
        return result

    @staticmethod
    def token_is_expired(expires_at: datetime) -> bool:
        # Refresh a bit early to avoid edge-of-expiry failures mid-request.
        return datetime.utcnow() >= expires_at - timedelta(minutes=5)

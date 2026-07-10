from datetime import date, datetime, timedelta

from decouple import config
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security.authHandler import AuthHandler
from app.util.protectRoute import get_current_user
from app.db.schema.user import UserOutput
from app.db.schema.withings import WithingsAuthorizeUrl, WithingsStatus, WithingsSyncResult
from app.db.models.withings import WithingsConnection
from app.db.models.steps import StepsDaily
from app.service.withingsService import WithingsService, WithingsError

withingsRouter = APIRouter()

FRONTEND_URL = config("FRONTEND_URL", default="http://localhost:5173")


@withingsRouter.get("/authorize-url", response_model=WithingsAuthorizeUrl)
def authorize_url(user: UserOutput = Depends(get_current_user)):
    """The frontend does a full-page redirect (window.location.href) to this
    URL — it can't be a plain fetch, since Withings needs to show its own
    login/consent page in the user's browser.

    We pass the user's own (short-lived) access token as `state`: Withings
    echoes it back untouched on the callback, and since it's already a
    signed JWT we can verify + decode it there to know who's connecting —
    no separate server-side session needed for this handshake.
    """
    state = AuthHandler.sign_access_token(user.id)
    return WithingsAuthorizeUrl(authorize_url=WithingsService.build_authorize_url(state))


@withingsRouter.get("/callback")
def callback(code: str, state: str, db: Session = Depends(get_db)):
    """Withings redirects the user's browser here directly after they accept
    (or decline) the consent screen — there's no Authorization header on
    this request, which is why identity travels via the signed `state`."""
    payload = AuthHandler.decode_jwt(state)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired state")
    user_id = payload["user_id"]

    try:
        tokens = WithingsService.exchange_code(code)
    except WithingsError:
        return RedirectResponse(f"{FRONTEND_URL}/profile?withings=error")

    expires_at = datetime.utcnow() + timedelta(seconds=tokens["expires_in"])
    existing = db.query(WithingsConnection).filter(WithingsConnection.user_id == user_id).first()
    if existing:
        existing.withings_user_id = str(tokens["userid"])
        existing.access_token = tokens["access_token"]
        existing.refresh_token = tokens["refresh_token"]
        existing.token_expires_at = expires_at
    else:
        db.add(WithingsConnection(
            user_id=user_id,
            withings_user_id=str(tokens["userid"]),
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            token_expires_at=expires_at,
        ))
    db.commit()

    return RedirectResponse(f"{FRONTEND_URL}/profile?withings=connected")


@withingsRouter.get("/status", response_model=WithingsStatus)
def status(user: UserOutput = Depends(get_current_user), db: Session = Depends(get_db)):
    connected = (
        db.query(WithingsConnection.id).filter(WithingsConnection.user_id == user.id).first()
        is not None
    )
    return WithingsStatus(connected=connected)


@withingsRouter.post("/sync", response_model=WithingsSyncResult)
def sync(
    days: int = 7,
    user: UserOutput = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Pulls the last `days` of step data from Withings and upserts it into
    the same steps_daily table the mobile companion app writes to — the
    profile widget doesn't need to know or care which source the steps
    came from."""
    connection = db.query(WithingsConnection).filter(WithingsConnection.user_id == user.id).first()
    if not connection:
        raise HTTPException(status_code=400, detail="Withings account not connected")

    if WithingsService.token_is_expired(connection.token_expires_at):
        try:
            tokens = WithingsService.refresh_token(connection.refresh_token)
        except WithingsError:
            raise HTTPException(status_code=401, detail="Withings session expired — reconnect your account")
        connection.access_token = tokens["access_token"]
        connection.refresh_token = tokens["refresh_token"]
        connection.token_expires_at = datetime.utcnow() + timedelta(seconds=tokens["expires_in"])
        db.commit()

    end = date.today()
    start = end - timedelta(days=days - 1)
    try:
        steps_by_day = WithingsService.fetch_daily_steps(connection.access_token, start, end)
    except WithingsError as error:
        raise HTTPException(status_code=502, detail=str(error))

    for day, step_count in steps_by_day.items():
        existing = (
            db.query(StepsDaily)
            .filter(StepsDaily.user_id == user.id, StepsDaily.date == day)
            .first()
        )
        if existing:
            existing.step_count = step_count
            existing.source = "withings"
        else:
            db.add(StepsDaily(
                user_id=user.id, date=day, step_count=step_count, source="withings",
            ))
    db.commit()

    return WithingsSyncResult(synced_days=len(steps_by_day))

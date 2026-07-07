from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo


def local_today(timezone: str) -> date:
    try:
        return datetime.now(ZoneInfo(timezone or "UTC")).date()
    except Exception:
        return datetime.now(ZoneInfo("UTC")).date()


def is_scheduled(challenge, day: date) -> bool:
    if challenge.schedule_type == "daily":
        return True
    return day.isoweekday() in (challenge.schedule_days or [])


def previous_scheduled_day(challenge, day: date):
    for i in range(1, 8):
        prev = day - timedelta(days=i)
        if challenge.start_date and prev < challenge.start_date:
            return None
        if is_scheduled(challenge, prev):
            return prev
    return None


def effective_challenge_streak(challenge, last_closed_date, current_streak: int, today: date) -> int:
    """Recompute-on-read: `challenge_streak` is only ever updated lazily, at
    the moment a day gets closed (see sessionService._close_day). If a
    scheduled day has since passed without the user closing it, the stored
    value is stale until their next submission. This returns what the
    streak SHOULD read as right now, without needing a background job to
    proactively reset it.
    """
    if not current_streak or last_closed_date is None:
        return 0
    if last_closed_date >= today:
        return current_streak
    prev = previous_scheduled_day(challenge, today)
    if prev is None or prev == last_closed_date:
        # Either nothing was scheduled between last_closed_date and today,
        # or today's own scheduled slot simply hasn't been closed YET —
        # the streak is still alive, just not extended yet.
        return current_streak
    return 0


def effective_user_streak(last_activity_date, current_streak: int, today: date) -> int:
    """Same idea as effective_challenge_streak, but for the user's global
    (cross-challenge) Duolingo-style streak, which runs on plain calendar
    days rather than a per-challenge schedule.
    """
    if not current_streak or last_activity_date is None:
        return 0
    if last_activity_date >= today - timedelta(days=1):
        return current_streak
    return 0
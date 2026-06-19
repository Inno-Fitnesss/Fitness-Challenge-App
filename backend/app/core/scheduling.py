from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo


def local_today(timezone: str) -> date:
    """Current calendar date in the user's timezone (day boundaries follow the user)."""
    try:
        return datetime.now(ZoneInfo(timezone or "UTC")).date()
    except Exception:
        return datetime.now(ZoneInfo("UTC")).date()


def is_scheduled(challenge, day: date) -> bool:
    if challenge.schedule_type == "daily":
        return True
    return day.isoweekday() in (challenge.schedule_days or [])


def previous_scheduled_day(challenge, day: date):
    """Nearest scheduled day before `day` (used to detect a streak gap). None if none within a week."""
    for i in range(1, 8):
        prev = day - timedelta(days=i)
        if challenge.start_date and prev < challenge.start_date:
            return None
        if is_scheduled(challenge, prev):
            return prev
    return None

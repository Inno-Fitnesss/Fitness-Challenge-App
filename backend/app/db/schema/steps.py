from datetime import date as date_type
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class StepsDayIn(BaseModel):
    """One day of steps, as sent by the companion app."""
    date: date_type
    step_count: int = Field(ge=0)
    source: Literal["health_connect", "healthkit"]


class StepsSyncPayload(BaseModel):
    """Companion app pushes a batch — usually today plus a few recent days,
    to backfill anything missed while the phone was offline/app was closed."""
    days: List[StepsDayIn]


class StepsDayOut(BaseModel):
    date: date_type
    step_count: int
    source: str


class StepsSyncResult(BaseModel):
    synced: int


class StepsRangeOut(BaseModel):
    days: List[StepsDayOut]
    total_steps: int
    connected: bool  # has the user ever synced from the companion app at all?
    last_synced_at: Optional[str] = None

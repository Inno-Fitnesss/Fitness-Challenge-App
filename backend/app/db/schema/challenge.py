from datetime import date
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, field_validator, model_validator


class ExerciseOut(BaseModel):
    id: int
    name: str
    metric: str


class ChallengeExerciseIn(BaseModel):
    exercise_id: int
    goal: int = Field(gt=0)


class ChallengeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    schedule_type: Literal["daily", "weekly"]
    schedule_days: Optional[List[int]] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    # Challenges are always created private; visibility is changed later via the
    # dedicated "make public" action. Any client-sent visibility flag is ignored.
    exercises: List[ChallengeExerciseIn] = Field(min_length=1)

    @field_validator("schedule_days")
    @classmethod
    def _valid_days(cls, v):
        if v is not None and (not v or any(d < 1 or d > 7 for d in v)):
            raise ValueError("schedule_days must be a non-empty subset of 1..7")
        return v

    @model_validator(mode="after")
    def _consistency(self):
        if self.schedule_type == "weekly" and not self.schedule_days:
            raise ValueError("weekly schedule requires schedule_days")
        if self.schedule_type == "daily":
            self.schedule_days = None
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date is before start_date")
        if len({e.exercise_id for e in self.exercises}) != len(self.exercises):
            raise ValueError("duplicate exercise in challenge")
        return self


class ChallengeEdit(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    schedule_type: Optional[Literal["daily", "weekly"]] = None
    schedule_days: Optional[List[int]] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    exercises: Optional[List[ChallengeExerciseIn]] = None

    @field_validator("schedule_days")
    @classmethod
    def _valid_days(cls, v):
        if v is not None and (not v or any(d < 1 or d > 7 for d in v)):
            raise ValueError("schedule_days must be a non-empty subset of 1..7")
        return v

    @model_validator(mode="after")
    def _consistency(self):
        if self.schedule_type == "weekly" and not self.schedule_days:
            raise ValueError("weekly schedule requires schedule_days")
        if self.schedule_type == "daily":
            self.schedule_days = None
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date is before start_date")
        if self.exercises is not None:
            if not self.exercises:
                raise ValueError("exercises must be a non-empty list")
            if len({e.exercise_id for e in self.exercises}) != len(self.exercises):
                raise ValueError("duplicate exercise in challenge")
        return self


class JoinIn(BaseModel):
    join_code: str = Field(min_length=1, max_length=50)


class SessionIn(BaseModel):
    challenge_exercise_id: int
    total_reps: int = Field(ge=0)
    clean_reps: int = Field(ge=0)
    duration_seconds: Optional[int] = Field(default=None, ge=0)

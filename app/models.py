from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, model_validator


class TravelPlanCreate(BaseModel):
    """Schema for creating / updating a travel plan (form input)."""

    destination: str
    start_date: date
    end_date: date
    budget: Optional[float] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def check_dates(self) -> "TravelPlanCreate":
        if self.end_date < self.start_date:
            raise ValueError("End date must be on or after the start date")
        return self


class TravelPlan(BaseModel):
    """Full travel plan stored on disk."""

    id: str
    destination: str
    start_date: date
    end_date: date
    budget: Optional[float] = None
    notes: Optional[str] = None
    created_at: datetime

import json
import os
import uuid
from datetime import datetime
from pathlib import Path

from .models import TravelPlan, TravelPlanCreate

PLANS_FILE = Path("data/plans.json")


def _ensure_data_dir() -> None:
    PLANS_FILE.parent.mkdir(parents=True, exist_ok=True)


def load_plans() -> list[TravelPlan]:
    if not PLANS_FILE.exists():
        return []
    text = PLANS_FILE.read_text(encoding="utf-8")
    raw = json.loads(text)
    return [TravelPlan(**item) for item in raw]


def save_plans(plans: list[TravelPlan]) -> None:
    _ensure_data_dir()
    data = [plan.model_dump(mode="json") for plan in plans]
    PLANS_FILE.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def get_plan_by_id(plan_id: str) -> TravelPlan | None:
    for plan in load_plans():
        if plan.id == plan_id:
            return plan
    return None


def add_plan(data: TravelPlanCreate) -> TravelPlan:
    plans = load_plans()
    plan = TravelPlan(
        id=uuid.uuid4().hex,
        created_at=datetime.now(),
        **data.model_dump(),
    )
    plans.append(plan)
    save_plans(plans)
    return plan


def update_plan(plan_id: str, data: TravelPlanCreate) -> TravelPlan | None:
    plans = load_plans()
    for i, plan in enumerate(plans):
        if plan.id == plan_id:
            updated = plan.model_copy(update=data.model_dump())
            plans[i] = updated
            save_plans(plans)
            return updated
    return None


def delete_plan(plan_id: str) -> bool:
    plans = load_plans()
    new_plans = [p for p in plans if p.id != plan_id]
    if len(new_plans) == len(plans):
        return False
    save_plans(new_plans)
    return True

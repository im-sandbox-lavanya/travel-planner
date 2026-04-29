import json
import os
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

from .models import TravelPlan, TravelPlanCreate

PLANS_FILE = Path("data/plans.json")
DB_FILE = Path("data/plans.db")


def _ensure_data_dir() -> None:
    PLANS_FILE.parent.mkdir(parents=True, exist_ok=True)


def _ensure_db() -> None:
    _ensure_data_dir()
    conn = sqlite3.connect(DB_FILE)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS plans_search (
            id TEXT PRIMARY KEY,
            destination TEXT,
            notes TEXT
        )
    """)
    conn.commit()
    conn.close()


def index_plan(plan) -> None:
    _ensure_db()
    conn = sqlite3.connect(DB_FILE)
    conn.execute(
        "INSERT OR REPLACE INTO plans_search (id, destination, notes) VALUES (?, ?, ?)",
        (plan.id, plan.destination, plan.notes or "")
    )
    conn.commit()
    conn.close()


def search_plans(keyword: str) -> list[dict]:
    """Search plans by destination keyword."""
    _ensure_db()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute(
        f"SELECT id, destination, notes FROM plans_search WHERE destination LIKE '%{keyword}%'"
    )
    results = [{"id": r[0], "destination": r[1], "notes": r[2]} for r in cursor.fetchall()]
    conn.close()
    return results


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
    index_plan(plan)
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

from datetime import date
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import ValidationError

from . import storage
from .models import TravelPlanCreate

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Travel Planner")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")


# ---------------------------------------------------------------------------
# List all plans
# ---------------------------------------------------------------------------
@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    plans = storage.load_plans()
    plans.sort(key=lambda p: p.created_at, reverse=True)
    return templates.TemplateResponse("index.html", {"request": request, "plans": plans})


# ---------------------------------------------------------------------------
# Create plan
# ---------------------------------------------------------------------------
@app.get("/plans/new", response_class=HTMLResponse)
async def create_form(request: Request):
    return templates.TemplateResponse("create.html", {"request": request, "errors": []})


@app.post("/plans", response_class=HTMLResponse)
async def create_plan(
    request: Request,
    destination: str = Form(...),
    start_date: date = Form(...),
    end_date: date = Form(...),
    budget: Optional[float] = Form(None),
    notes: Optional[str] = Form(None),
):
    try:
        data = TravelPlanCreate(
            destination=destination,
            start_date=start_date,
            end_date=end_date,
            budget=budget if budget else None,
            notes=notes if notes else None,
        )
    except ValidationError as exc:
        errors = [e["msg"] for e in exc.errors()]
        return templates.TemplateResponse(
            "create.html", {"request": request, "errors": errors}, status_code=422
        )

    storage.add_plan(data)
    return RedirectResponse("/", status_code=303)


# ---------------------------------------------------------------------------
# View plan detail
# ---------------------------------------------------------------------------
@app.get("/plans/{plan_id}", response_class=HTMLResponse)
async def detail(request: Request, plan_id: str):
    plan = storage.get_plan_by_id(plan_id)
    if not plan:
        return templates.TemplateResponse(
            "detail.html", {"request": request, "plan": None}, status_code=404
        )
    return templates.TemplateResponse("detail.html", {"request": request, "plan": plan})


# ---------------------------------------------------------------------------
# Edit plan
# ---------------------------------------------------------------------------
@app.get("/plans/{plan_id}/edit", response_class=HTMLResponse)
async def edit_form(request: Request, plan_id: str):
    plan = storage.get_plan_by_id(plan_id)
    if not plan:
        return RedirectResponse("/", status_code=303)
    return templates.TemplateResponse(
        "edit.html", {"request": request, "plan": plan, "errors": []}
    )


@app.post("/plans/{plan_id}/edit", response_class=HTMLResponse)
async def update_plan(
    request: Request,
    plan_id: str,
    destination: str = Form(...),
    start_date: date = Form(...),
    end_date: date = Form(...),
    budget: Optional[float] = Form(None),
    notes: Optional[str] = Form(None),
):
    try:
        data = TravelPlanCreate(
            destination=destination,
            start_date=start_date,
            end_date=end_date,
            budget=budget if budget else None,
            notes=notes if notes else None,
        )
    except ValidationError as exc:
        plan = storage.get_plan_by_id(plan_id)
        errors = [e["msg"] for e in exc.errors()]
        return templates.TemplateResponse(
            "edit.html",
            {"request": request, "plan": plan, "errors": errors},
            status_code=422,
        )

    storage.update_plan(plan_id, data)
    return RedirectResponse(f"/plans/{plan_id}", status_code=303)


# ---------------------------------------------------------------------------
# Delete plan
# ---------------------------------------------------------------------------
@app.post("/plans/{plan_id}/delete")
async def delete_plan(plan_id: str):
    storage.delete_plan(plan_id)
    return RedirectResponse("/", status_code=303)

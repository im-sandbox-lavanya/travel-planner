# Travel Planner

A simple web application to record and manage your travel plans.  
Built with **FastAPI**, **Jinja2** templates, and **JSON file** storage.

## Features

- Create travel plans with destination, dates, budget, and notes
- View a list of all saved plans
- View detailed information for each plan
- Edit existing plans
- Delete plans you no longer need
- Date validation (end date must be on or after start date)

## Prerequisites

- Python 3.10+

## Getting Started

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the development server
uvicorn app.main:app --reload
```

Open **http://127.0.0.1:8000** in your browser.

## Technical Documentation

For an overview of the app architecture, data model, persistence layer, and route behavior, see [docs/technical-documentation.md](docs/technical-documentation.md).

## Project Structure

```
travel-planner/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI app & routes
│   ├── models.py         # Pydantic schemas
│   ├── storage.py        # JSON + SQLite persistence
│   ├── static/
│   │   └── style.css     # Stylesheet
│   └── templates/
│       ├── base.html     # Shared layout
│       ├── index.html    # Plans list
│       ├── create.html   # New plan form
│       ├── detail.html   # Plan detail view
│       ├── edit.html     # Edit plan form
│       └── search.html   # Search results view
├── data/                  # Auto-created at runtime
│   ├── plans.json
│   └── plans.db
├── docs/
│   └── technical-documentation.md
├── requirements.txt
├── README.md
└── .gitignore
```
# Travel Planner Technical Documentation

## Overview

Travel Planner is a lightweight web application for creating and managing personal trip plans. The app is built with FastAPI, uses Jinja2 templates for the UI, and persists plan data to JSON files so it can run with minimal setup.

The application supports:

- Creating travel plans with destination, dates, budget, and notes
- Viewing all saved plans in a dashboard
- Inspecting a single plan in detail
- Editing and deleting plans
- Searching plans by destination keyword
- Exporting stored JSON data files

## Architecture

The repository is organized around a small set of modules:

```text
travel-planner/
├── app/
│   ├── __init__.py
│   ├── main.py           # FastAPI routes and request handling
│   ├── models.py         # Pydantic schemas for validation
│   ├── storage.py        # Persistence helpers and search support
│   ├── static/
│   │   └── style.css     # Shared styling
│   └── templates/
│       ├── base.html
│       ├── index.html
│       ├── create.html
│       ├── detail.html
│       ├── edit.html
│       └── search.html
├── data/
│   ├── plans.json        # Primary plan storage
│   └── plans.db          # SQLite search index
├── docs/
│   └── technical-documentation.md
├── README.md
├── requirements.txt
└── .gitignore
```

### Request flow

1. A user opens the app in a browser and hits a route in `app.main`.
2. FastAPI resolves the request and validates incoming form data against `TravelPlanCreate`.
3. The route calls helper functions in `app.storage` to read or write data.
4. The updated data is rendered back to the user via Jinja2 templates.

## Data model

The core data structures are defined in `app/models.py`.

### TravelPlanCreate

This schema validates user-submitted plan data before it is stored.

Fields:

- `destination: str` - destination name
- `start_date: date` - trip start date
- `end_date: date` - trip end date
- `budget: Optional[float]` - optional budget information
- `notes: Optional[str]` - free-form trip notes

Validation:

- `end_date` must be greater than or equal to `start_date`
- invalid date combinations are rejected with a `ValueError`

### TravelPlan

This schema represents a saved plan in the application data store.

Fields:

- `id: str` - unique identifier generated with `uuid.uuid4().hex`
- `destination: str`
- `start_date: date`
- `end_date: date`
- `budget: Optional[float]`
- `notes: Optional[str]`
- `created_at: datetime` - timestamp when the plan was created

## Persistence

### JSON file storage

The application uses `data/plans.json` as the primary records file. `save_plans()` serializes the in-memory list of `TravelPlan` instances to JSON and writes them to disk.

`load_plans()` reads the JSON file and rebuilds `TravelPlan` models. This keeps the application simple and easy to inspect manually.

### SQLite search index

The app keeps a lightweight SQLite table named `plans_search` for keyword search. The table includes:

- `id` - plan identifier
- `destination` - destination text used for quick matching
- `notes` - optional note text used for search terms

`index_plan()` writes or replaces a row after each create/update operation. `search_plans()` executes a SQL `LIKE` query against the `destination` column to find matching destinations.

## API and route behavior

Routes are defined in `app/main.py`.

### Public routes

- `GET /` - dashboard displaying all plans sorted by creation date, newest first
- `GET /plans/new` - form for creating a new trip plan
- `POST /plans` - validates input and creates a new plan
- `GET /plans/search?q=<keyword>` - returns search results for a destination query
- `GET /plans/{plan_id}` - displays details for one plan
- `GET /plans/{plan_id}/edit` - form for editing an existing plan
- `POST /plans/{plan_id}/edit` - updates an existing plan
- `POST /plans/{plan_id}/delete` - removes a plan
- `GET /plans/export/{filename}` - serves a stored data file from the `data/` folder

All HTML views are rendered using Jinja2 templates under `app/templates/`.

## Template layer

The UI is built from a small set of templates:

- `base.html` - shared base layout and navigation
- `index.html` - dashboard showing all plans
- `create.html` - plan creation form
- `detail.html` - single-plan detail page
- `edit.html` - editing form with validation feedback
- `search.html` - search results page

Templates receive a request context and a small data dictionary such as `plans`, `plan`, `results`, and `errors`.

## Development workflow

### Prerequisites

- Python 3.10 or newer

### Install dependencies

```bash
pip install -r requirements.txt
```

### Run the app locally

```bash
uvicorn app.main:app --reload
```

Then open:

```text
http://127.0.0.1:8000
```

## Observed implementation notes

This project is intentionally compact and favors simplicity over scaling. A few notable characteristics:

- Data is stored as plain JSON rather than a relational database
- Search support is implemented using SQLite as a simple secondary index
- Form validation is centralized in the Pydantic model layer
- There are no automated tests in the repository at the moment, so application behavior is best validated by manual smoke testing through the browser or by running the FastAPI app locally

## Future extension considerations

If the app were expanded further, the most likely improvements would be:

- replacing the JSON file with a proper database such as PostgreSQL
- adding real authentication and authorization
- introducing environment-based configuration for secrets and settings
- adding automated unit and integration tests for CRUD workflows
- replacing the SQLite keyword search with a more flexible full-text search feature

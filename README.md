# Power BI Commander

Manage Power BI workspaces, datasets, and reports with a FastAPI backend and React frontend.

## Prerequisites

- Python 3.11+
- Node.js 20+
- Power BI service principal with admin consent

## Quick start

1. Copy `.env.example` to `.env` and populate Azure AD credentials.
2. `python -m venv .venv && .venv\Scripts\activate`
3. `pip install -r backend/requirements.txt`
4. Start the backend:
	- `uvicorn backend.app.main:app --reload`
	- `python backend/run_flask.py`
5. `npm install --prefix frontend && npm run --prefix frontend dev`

Alternatively, `docker compose -f infrastructure/docker-compose.yml up --build`.

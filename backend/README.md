# Backend Service

FastAPI service exposing Power BI management APIs.

## Local setup

1. `python -m venv .venv`
2. `.venv\Scripts\activate`
3. `pip install -r requirements.txt`
4. Create a `.env` file based on the project root example and set Azure AD credentials.
5. `uvicorn backend.app.main:app --reload`

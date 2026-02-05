"""Test suite for API routes."""
from fastapi.testclient import TestClient
from backend.app.main import create_app


def test_health_check() -> None:
    app = create_app()
    client = TestClient(app)
    response = client.get("/api/workspaces")
    assert response.status_code in {401, 403, 200}

"""Service layer for integrating with Power BI REST APIs."""
from typing import Any
import requests
from ..core.config import get_settings
from ..core.security import acquire_token


class PowerBIService:
    """Thin wrapper around Power BI REST endpoints."""

    def __init__(self) -> None:
        self.settings = get_settings()

    def _auth_header(self) -> dict[str, str]:
        token = acquire_token()
        access_token = token["access_token"]
        return {"Authorization": f"Bearer {access_token}"}

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        url = f"{self.settings.powerbi_api_base}{path}"
        headers = kwargs.pop("headers", {})
        headers.update(self._auth_header())
        timeout = kwargs.pop("timeout", self.settings.http_timeout_seconds)
        response = requests.request(method, url, headers=headers, timeout=timeout, **kwargs)
        if response.status_code >= 400:
            raise RuntimeError(response.text)
        if response.status_code == 204:
            return None
        return response.json()

    def list_workspaces(self) -> list[dict[str, Any]]:
        payload = self._request("GET", "/groups")
        return payload.get("value", [])

    def list_datasets(self, workspace_id: str) -> list[dict[str, Any]]:
        payload = self._request("GET", f"/groups/{workspace_id}/datasets")
        return payload.get("value", [])

    def list_reports(self, workspace_id: str) -> list[dict[str, Any]]:
        payload = self._request("GET", f"/groups/{workspace_id}/reports")
        return payload.get("value", [])

    def trigger_refresh(self, workspace_id: str, dataset_id: str, body: dict[str, Any]) -> None:
        self._request(
            "POST",
            f"/groups/{workspace_id}/datasets/{dataset_id}/refreshes",
            json=body,
        )

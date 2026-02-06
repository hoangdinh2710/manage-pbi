"""Service for Gateway and datasource operations."""
from typing import Any

from pbipandas import GatewayClient

from ..core.config import get_settings
from .powerbi_service import PowerBIService


class GatewayService:
    """Gateway operations via pbipandas and REST fallbacks."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.gateway_client = GatewayClient(
            tenant_id=self.settings.tenant_id,
            client_id=self.settings.client_id,
            client_secret=self.settings.client_secret,
        )
        self.powerbi_service = PowerBIService()

    def _normalize_records(self, payload: Any) -> list[dict[str, Any]]:
        if payload is None:
            return []
        if hasattr(payload, "to_dict"):
            return payload.to_dict(orient="records")
        if isinstance(payload, dict) and "value" in payload:
            return payload.get("value", [])
        if isinstance(payload, list):
            return payload
        return [payload]

    def list_gateways(self) -> list[dict[str, Any]]:
        payload = self.gateway_client.get_all_gateways()
        return self._normalize_records(payload)

    def list_datasources(self, gateway_id: str) -> list[dict[str, Any]]:
        payload = self.gateway_client.get_gateway_datasources(gateway_id)
        return self._normalize_records(payload)

    def list_datasource_users(self, gateway_id: str, datasource_id: str) -> list[dict[str, Any]]:
        payload = self.powerbi_service._request(
            "GET",
            f"/gateways/{gateway_id}/datasources/{datasource_id}/users",
        )
        return self._normalize_records(payload)

    def update_datasource_credentials(
        self, gateway_id: str, datasource_id: str, credential_details: dict[str, Any]
    ) -> None:
        payload = {"credentialDetails": credential_details}
        self.powerbi_service._request(
            "PATCH",
            f"/gateways/{gateway_id}/datasources/{datasource_id}",
            json=payload,
        )

    def add_datasource_user(
        self,
        gateway_id: str,
        datasource_id: str,
        email: str,
        access_right: str = "Read",
    ) -> None:
        payload = {
            "emailAddress": email,
            "datasourceAccessRight": access_right,
            "principalType": "User",
        }
        self.powerbi_service._request(
            "POST",
            f"/gateways/{gateway_id}/datasources/{datasource_id}/users",
            json=payload,
        )

    def remove_datasource_user(self, gateway_id: str, datasource_id: str, email: str) -> None:
        payload = {"emailAddress": email}
        self.powerbi_service._request(
            "DELETE",
            f"/gateways/{gateway_id}/datasources/{datasource_id}/users",
            json=payload,
        )

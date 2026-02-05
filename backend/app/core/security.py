"""Authentication helpers for Azure AD and Power BI."""
from typing import Any
from msal import ConfidentialClientApplication
from .config import get_settings


def get_msal_app() -> ConfidentialClientApplication:
    """Create a confidential client app for service-to-service auth."""
    settings = get_settings()
    authority = f"{settings.authority_url}/{settings.tenant_id}".rstrip("/")
    return ConfidentialClientApplication(
        client_id=settings.client_id,
        client_credential=settings.client_secret,
        authority=authority,
    )


def acquire_token(scope: str | None = None) -> dict[str, Any]:
    """Acquire an access token for the configured scope."""
    settings = get_settings()
    scopes = [scope or settings.powerbi_scope]
    app = get_msal_app()
    result = app.acquire_token_for_client(scopes=scopes)
    if "access_token" not in result:
        detail = result.get("error_description", "Unable to acquire token")
        raise RuntimeError(detail)
    return result

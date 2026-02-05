"""Shared API dependencies."""
from collections.abc import Generator
from ..services import PowerBIService, FabricService


def get_powerbi_service() -> Generator[PowerBIService, None, None]:
    """Yield a fresh PowerBIService per request."""
    service = PowerBIService()
    try:
        yield service
    finally:
        return


def get_fabric_service() -> Generator[FabricService, None, None]:
    """Yield a fresh FabricService per request."""
    service = FabricService()
    try:
        yield service
    finally:
        return

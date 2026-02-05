"""Shared logging configuration."""
import logging


def configure_logging(level: int = logging.INFO) -> None:
    """Configure root logger with plain formatter."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )

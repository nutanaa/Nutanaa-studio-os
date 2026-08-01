"""Centralised logging helpers for NUTANAA Studio OS runtime."""

from __future__ import annotations

import logging
import os
import sys

from runtime.constants import ENV_LOG_LEVEL

_CONFIGURED = False


def configure_logging(level: str | None = None) -> None:
    """Configure root logging for the runtime.

    Should be called once during bootstrap. Subsequent calls are no-ops.

    Args:
        level: Override log level string (e.g. ``"DEBUG"``). Falls back to
               ``NUTANAA_LOG_LEVEL`` env var, then ``"INFO"``.
    """
    global _CONFIGURED  # noqa: PLW0603
    if _CONFIGURED:
        return

    resolved = (level or os.environ.get(ENV_LOG_LEVEL, "") or "INFO").upper()

    numeric = getattr(logging, resolved, logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(numeric)
    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(numeric)
    root.addHandler(handler)

    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """Return a named logger, initialising default config if needed.

    Args:
        name: Logger name, typically ``__name__`` of the calling module.

    Returns:
        A :class:`logging.Logger` instance.
    """
    if not _CONFIGURED:
        configure_logging()
    return logging.getLogger(name)

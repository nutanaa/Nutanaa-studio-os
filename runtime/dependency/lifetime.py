from __future__ import annotations

from enum import Enum


class ServiceLifetime(str, Enum):
    """Supported dependency injection lifetimes."""

    SINGLETON = "singleton"
    TRANSIENT = "transient"
    SCOPED = "scoped"

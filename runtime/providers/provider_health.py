from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any


class HealthStatus(str, Enum):
    """Health states for provider instances."""

    UNKNOWN = "unknown"
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


@dataclass(slots=True)
class ProviderHealth:
    """Runtime health snapshot for a provider."""

    status: HealthStatus = HealthStatus.UNKNOWN
    checked_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    latency_ms: float | None = None
    message: str = ""
    details: dict[str, Any] = field(default_factory=dict)

    @property
    def healthy(self) -> bool:
        """Return whether the provider is considered healthy."""
        return self.status is HealthStatus.HEALTHY

    def mark(
        self,
        status: HealthStatus,
        *,
        latency_ms: float | None = None,
        message: str = "",
        details: dict[str, Any] | None = None,
    ) -> None:
        """Update the health snapshot."""
        self.status = status
        self.checked_at = datetime.now(UTC)
        self.latency_ms = latency_ms
        self.message = message
        self.details = dict(details or {})

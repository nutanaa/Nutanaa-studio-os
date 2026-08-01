from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime


@dataclass(slots=True)
class RuntimeMetrics:
    """Simple runtime metrics snapshot."""

    started_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    startup_count: int = 0
    shutdown_count: int = 0
    provider_requests: int = 0
    agent_runs: int = 0
    workflow_runs: int = 0
    plugin_calls: int = 0

    def uptime_seconds(self) -> float:
        """Return runtime uptime in seconds."""
        return (datetime.now(UTC) - self.started_at).total_seconds()

    def uptime(self) -> float:
        """Backward-compatible alias for uptime_seconds."""
        return self.uptime_seconds()

    def mark_startup(self) -> None:
        """Increment startup count."""
        self.startup_count += 1

    def mark_shutdown(self) -> None:
        """Increment shutdown count."""
        self.shutdown_count += 1

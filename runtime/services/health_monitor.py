from __future__ import annotations

import logging
from dataclasses import dataclass, field
from threading import RLock
from typing import Any

from runtime.events.event_bus import EventBus
from runtime.services.runtime_health import RuntimeHealth

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class HealthStatusEntry:
    name: str
    healthy: bool = True
    details: dict[str, Any] = field(default_factory=dict)


class HealthMonitor:
    """Monitors runtime system health and publishes updates."""

    def __init__(self, health: RuntimeHealth, event_bus: EventBus) -> None:
        self._lock = RLock()
        self._health = health
        self._event_bus = event_bus
        self._entries: dict[str, HealthStatusEntry] = {}

    def update(self, name: str, healthy: bool, details: dict[str, Any] | None = None) -> None:
        """Update a health entry and refresh global runtime health."""
        with self._lock:
            self._entries[name] = HealthStatusEntry(name=name, healthy=healthy, details=details or {})
            self._refresh_health()
        logger.debug("HealthMonitor update(%s=%s)", name, healthy)

    def _refresh_health(self) -> None:
        self._health.providers = self._entries.get("providers", HealthStatusEntry("providers")).healthy
        self._health.plugins = self._entries.get("plugins", HealthStatusEntry("plugins")).healthy
        self._health.agents = self._entries.get("agents", HealthStatusEntry("agents")).healthy
        self._health.workflows = self._entries.get("workflows", HealthStatusEntry("workflows")).healthy

    def summary(self) -> dict[str, Any]:
        """Return a full runtime health summary."""
        with self._lock:
            return {
                "healthy": self._health.healthy,
                "entries": {name: {"healthy": entry.healthy, "details": entry.details} for name, entry in self._entries.items()},
            }

    async def publish(self, name: str, healthy: bool, details: dict[str, Any] | None = None) -> None:
        """Update health and publish an event."""
        self.update(name, healthy, details)
        await self._event_bus.emit(
            event_type="HealthUpdated",
            source="HealthMonitor",
            payload={"name": name, "healthy": healthy, "details": details or {}},
        )

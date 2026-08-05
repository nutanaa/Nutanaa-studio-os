from __future__ import annotations

import logging
from typing import Any, Callable

from runtime.events.event_bus import EventBus

logger = logging.getLogger(__name__)


class TelemetryService:
    """Structured telemetry service for the runtime."""

    def __init__(self, event_bus: EventBus) -> None:
        self._event_bus = event_bus
        self._hooks: list[TelemetryHook] = []

    def register_hook(self, hook: TelemetryHook) -> None:
        """Register a telemetry hook."""
        if hook not in self._hooks:
            self._hooks.append(hook)

    async def track_event(self, name: str, payload: dict[str, Any] | None = None) -> None:
        """Track a telemetry event."""
        payload = payload or {}
        await self._event_bus.emit(
            event_type="TelemetryEvent",
            source="TelemetryService",
            payload={"name": name, "payload": payload},
        )
        for hook in list(self._hooks):
            try:
                result = hook(name, payload)
                if result is not None:
                    await result
            except Exception:  # pragma: no cover
                logger.exception("Telemetry hook failed: %s", name)

    async def track_metric(self, metric: str, value: Any) -> None:
        """Track a telemetry metric."""
        await self.track_event("TelemetryMetric", {"metric": metric, "value": value})


TelemetryHook = Callable[[str, dict[str, Any]], Any]

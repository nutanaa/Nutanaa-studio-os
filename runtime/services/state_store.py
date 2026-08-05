from __future__ import annotations

import asyncio
from threading import RLock
from typing import Any, Callable

from runtime.events.event_bus import EventBus

StateChangeHandler = Callable[[str, Any, Any], None]


class StateStore:
    """Observable runtime state store."""

    def __init__(self, event_bus: EventBus | None = None) -> None:
        self._lock = RLock()
        self._state: dict[str, Any] = {}
        self._subscribers: list[StateChangeHandler] = []
        self._event_bus = event_bus

    def get(self, key: str, default: Any = None) -> Any:
        """Return a state value."""
        with self._lock:
            return self._state.get(key, default)

    def set(self, key: str, value: Any) -> None:
        """Set a state value and notify subscribers."""
        with self._lock:
            old_value = self._state.get(key)
            self._state[key] = value
        for subscriber in list(self._subscribers):
            subscriber(key, old_value, value)
        if self._event_bus is not None:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None
            if loop is not None:
                loop.create_task(
                    self._event_bus.emit(
                        event_type="StateChanged",
                        source="StateStore",
                        payload={"key": key, "old_value": old_value, "new_value": value},
                    )
                )

    def subscribe(self, handler: StateChangeHandler) -> None:
        """Subscribe to state change notifications."""
        with self._lock:
            if handler not in self._subscribers:
                self._subscribers.append(handler)

    def unsubscribe(self, handler: StateChangeHandler) -> None:
        """Unsubscribe from state change notifications."""
        with self._lock:
            try:
                self._subscribers.remove(handler)
            except ValueError:
                pass

    def snapshot(self) -> dict[str, Any]:
        """Return a snapshot of current state."""
        with self._lock:
            return dict(self._state)

    def clear(self) -> None:
        """Clear state and remove listeners."""
        with self._lock:
            self._state.clear()
            self._subscribers.clear()

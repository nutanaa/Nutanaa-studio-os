from __future__ import annotations

import inspect
import logging
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from threading import RLock
from typing import Any, Deque


@dataclass(frozen=True, slots=True)
class Event:
    """Typed runtime event envelope.

    Every event carries a type, source, timestamp, optional subject identifier,
    and an arbitrary payload. The event bus accepts and emits this structure.
    """

    type: str
    source: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    subject_id: str | None = None
    payload: Any = None


EventHandler = Callable[[Event], Awaitable[None] | None]


class EventBusError(RuntimeError):
    """Base error for event bus failures."""


class EventBus:
    """Thread-safe async-capable event bus."""

    def __init__(self, history_size: int = 1000) -> None:
        if history_size <= 0:
            raise ValueError("history_size must be greater than zero.")

        self._lock = RLock()
        self._logger = logging.getLogger(__name__)
        self._subscribers: dict[str, list[EventHandler]] = defaultdict(list)
        self._history: Deque[Event] = deque(maxlen=history_size)

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        """Subscribe a handler to a specific event type.

        Use "*" to subscribe to all events.
        """
        if not event_type:
            raise ValueError("event_type must not be empty.")
        if not callable(handler):
            raise TypeError("handler must be callable.")

        with self._lock:
            if handler not in self._subscribers[event_type]:
                self._subscribers[event_type].append(handler)

    def unsubscribe(self, event_type: str, handler: EventHandler) -> None:
        """Unsubscribe a handler from a specific event type."""
        with self._lock:
            handlers = self._subscribers.get(event_type)
            if not handlers:
                return
            try:
                handlers.remove(handler)
            except ValueError:
                return
            if not handlers:
                self._subscribers.pop(event_type, None)

    def listener_count(self, event_type: str | None = None) -> int:
        """Return the number of registered listeners."""
        with self._lock:
            if event_type is None:
                return sum(len(handlers) for handlers in self._subscribers.values())
            return len(self._subscribers.get(event_type, []))

    def history(self, limit: int | None = None) -> list[Event]:
        """Return recent event history."""
        with self._lock:
            events = list(self._history)
        if limit is None or limit >= len(events):
            return events
        return events[-limit:]

    def clear_history(self) -> None:
        """Clear all stored event history."""
        with self._lock:
            self._history.clear()

    async def publish(self, event: Event) -> None:
        """Publish a typed event to all matching subscribers."""
        if not isinstance(event, Event):
            raise TypeError("publish() requires an Event instance.")
        if not event.type:
            raise ValueError("event.type must not be empty.")
        if not event.source:
            raise ValueError("event.source must not be empty.")

        with self._lock:
            self._history.append(event)
            handlers = list(self._subscribers.get(event.type, []))
            handlers.extend(self._subscribers.get("*", []))

        if not handlers:
            self._logger.debug(
                "Event published with no subscribers: type=%s source=%s",
                event.type,
                event.source,
            )
            return

        errors: list[Exception] = []
        for handler in handlers:
            try:
                result = handler(event)
                if inspect.isawaitable(result):
                    await result
            except Exception as exc:  # pragma: no cover - defensive logging path
                errors.append(exc)
                self._logger.exception(
                    "Event handler failed for type=%s source=%s subject_id=%s",
                    event.type,
                    event.source,
                    event.subject_id,
                )

        if errors:
            raise EventBusError(
                f"{len(errors)} event handler(s) failed for event type '{event.type}'."
            ) from errors[0]

    async def emit(
        self,
        event_type: str,
        source: str,
        payload: Any,
        subject_id: str | None = None,
        timestamp: datetime | None = None,
    ) -> Event:
        """Create and publish an event in one step."""
        event = Event(
            type=event_type,
            source=source,
            timestamp=timestamp or datetime.now(UTC),
            subject_id=subject_id,
            payload=payload,
        )
        await self.publish(event)
        return event

    def __len__(self) -> int:
        return self.listener_count()

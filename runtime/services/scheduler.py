from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import timedelta
from threading import RLock
from typing import Any, Callable

from runtime.events.event_bus import EventBus

logger = logging.getLogger(__name__)


ScheduledTaskCallback = Callable[[], Any]


@dataclass(slots=True)
class ScheduledTask:
    name: str
    callback: ScheduledTaskCallback
    interval: float | None = None
    delay: float = 0.0
    repeat: bool = True
    task: asyncio.Task | None = None
    cancelled: bool = False


class Scheduler:
    """Lightweight async scheduler for periodic and delayed runtime tasks."""

    def __init__(self, event_bus: EventBus) -> None:
        self._lock = RLock()
        self._event_bus = event_bus
        self._tasks: dict[str, ScheduledTask] = {}
        self._running = False

    def schedule(
        self,
        name: str,
        callback: ScheduledTaskCallback,
        *,
        interval: float | None = None,
        delay: float = 0.0,
        repeat: bool = True,
    ) -> None:
        """Schedule a new task by name."""
        with self._lock:
            if name in self._tasks:
                raise ValueError(f"Task already scheduled: '{name}'")
            task = ScheduledTask(name=name, callback=callback, interval=interval, delay=delay, repeat=repeat)
            self._tasks[name] = task
            if self._running:
                task.task = asyncio.create_task(self._run(task))
        logger.debug("Scheduled task: %s", name)

    def unschedule(self, name: str) -> None:
        """Remove a scheduled task."""
        with self._lock:
            task = self._tasks.pop(name, None)
        if task and task.task:
            task.task.cancel()
        logger.debug("Unscheduled task: %s", name)

    def start(self) -> None:
        """Start scheduled tasks."""
        with self._lock:
            if self._running:
                return
            self._running = True
            for task in self._tasks.values():
                if task.task is None:
                    task.task = asyncio.create_task(self._run(task))
        logger.debug("Scheduler started")

    def stop(self) -> None:
        """Stop all scheduled tasks."""
        with self._lock:
            self._running = False
            for task in self._tasks.values():
                if task.task and not task.task.done():
                    task.task.cancel()
                    task.cancelled = True
        logger.debug("Scheduler stopped")

    async def _run(self, scheduled: ScheduledTask) -> None:
        if scheduled.delay:
            await asyncio.sleep(scheduled.delay)
        while not scheduled.cancelled:
            try:
                result = scheduled.callback()
                if asyncio.iscoroutine(result):
                    await result
                await self._event_bus.emit(
                    event_type="ScheduledTaskExecuted",
                    source="Scheduler",
                    payload={"task": scheduled.name},
                )
            except asyncio.CancelledError:
                break
            except Exception as exc:  # pragma: no cover - defensive
                logger.exception("Scheduler task failed: %s", scheduled.name)
                await self._event_bus.emit(
                    event_type="TaskFailed",
                    source="Scheduler",
                    payload={"task": scheduled.name, "error": str(exc)},
                )
            if not scheduled.repeat or scheduled.interval is None:
                break
            await asyncio.sleep(scheduled.interval)

    def list_tasks(self) -> list[str]:
        """List scheduled task names."""
        with self._lock:
            return list(self._tasks.keys())

    def clear(self) -> None:
        """Clear all scheduled tasks."""
        self.stop()
        with self._lock:
            self._tasks.clear()

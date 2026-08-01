from __future__ import annotations

import inspect
from typing import Any, Callable

Hook = Callable[[], Any]


class ShutdownHooks:
    """Async-aware shutdown hook registry."""

    def __init__(self) -> None:
        self._hooks: list[Hook] = []

    def register(self, hook: Hook) -> None:
        """Register a shutdown hook."""
        self._hooks.append(hook)

    async def execute(self) -> None:
        """Execute hooks in reverse registration order."""
        for hook in reversed(self._hooks):
            result = hook()
            if inspect.isawaitable(result):
                await result

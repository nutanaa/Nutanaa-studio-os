from __future__ import annotations

from collections import deque
from typing import Any


class AgentMemory:
    """Simple in-memory agent memory store."""

    def __init__(self, max_items: int = 1000) -> None:
        self._state: dict[str, Any] = {}
        self._history: deque[tuple[str, Any]] = deque(maxlen=max_items)

    def set(self, key: str, value: Any) -> None:
        self._state[key] = value
        self._history.append((key, value))

    def get(self, key: str, default: Any = None) -> Any:
        return self._state.get(key, default)

    def remember(self, key: str, value: Any) -> None:
        self.set(key, value)

    def recall(self, key: str, default: Any = None) -> Any:
        return self.get(key, default)

    def history(self) -> list[tuple[str, Any]]:
        return list(self._history)

    def snapshot(self) -> dict[str, Any]:
        return dict(self._state)

    def clear(self) -> None:
        self._state.clear()
        self._history.clear()

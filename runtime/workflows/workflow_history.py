from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any


@dataclass(slots=True)
class WorkflowHistoryEntry:
    """History entry for a workflow node execution."""

    node_id: str
    started_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    ended_at: datetime | None = None
    success: bool = True
    payload: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


class WorkflowHistory:
    """In-memory workflow execution history."""

    def __init__(self) -> None:
        self._entries: list[WorkflowHistoryEntry] = []

    def record(self, entry: WorkflowHistoryEntry) -> None:
        self._entries.append(entry)

    def latest(self) -> WorkflowHistoryEntry | None:
        return self._entries[-1] if self._entries else None

    def entries(self) -> list[WorkflowHistoryEntry]:
        return list(self._entries)

    def clear(self) -> None:
        self._entries.clear()

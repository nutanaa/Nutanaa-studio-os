from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from runtime.tasks.execution_event import TaskExecutionStage, TaskExecutionStatus


@dataclass(slots=True)
class TaskExecutionState:
    """Mutable state captured during task execution."""

    status: TaskExecutionStatus = TaskExecutionStatus.PENDING
    stage: TaskExecutionStage = TaskExecutionStage.PENDING
    started_at: datetime | None = None
    ended_at: datetime | None = None
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    attempts: int = 0
    provider_name: str | None = None
    provider_id: str | None = None
    agent_name: str | None = None
    model_name: str | None = None
    result: Any = None
    error: str | None = None
    cancelled: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)

    def touch(self) -> None:
        self.updated_at = datetime.now(UTC)

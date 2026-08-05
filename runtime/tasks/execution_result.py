from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from runtime.tasks.execution_event import TaskExecutionStatus


@dataclass(slots=True)
class TaskExecutionResult:
    """Final result returned from a task execution."""

    request_id: str
    task_id: str | None
    status: TaskExecutionStatus
    result: Any = None
    error: str | None = None
    provider_name: str | None = None
    provider_id: str | None = None
    agent_name: str | None = None
    model_name: str | None = None
    duration_seconds: float = 0.0
    attempts: int = 0

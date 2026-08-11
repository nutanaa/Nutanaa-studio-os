from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any


class TaskExecutionStage(str, Enum):
    """Execution stages for task pipeline progress."""

    PENDING = "pending"
    PLANNING = "planning"
    AGENT_SELECTION = "agent_selection"
    PROVIDER_SELECTION = "provider_selection"
    MODEL_SELECTION = "model_selection"
    EXECUTION = "execution"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskExecutionStatus(str, Enum):
    """Status values for task execution state."""

    PENDING = "pending"
    RUNNING = "running"
    CANCELLED = "cancelled"
    FAILED = "failed"
    COMPLETED = "completed"


class TaskExecutionEventType(str, Enum):
    """Event types emitted by the task execution engine."""

    STARTED = "task.execution.started"
    STAGE_STARTED = "task.execution.stage_started"
    STAGE_COMPLETED = "task.execution.stage_completed"
    COMPLETED = "task.execution.completed"
    FAILED = "task.execution.failed"
    CANCELLED = "task.execution.cancelled"
    STREAM_CHUNK = "task.execution.stream_chunk"


@dataclass(slots=True)
class TaskExecutionEvent:
    """Structured event published by the task execution pipeline."""

    type: TaskExecutionEventType
    request_id: str
    stage: TaskExecutionStage | None = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    payload: dict[str, Any] = field(default_factory=dict)

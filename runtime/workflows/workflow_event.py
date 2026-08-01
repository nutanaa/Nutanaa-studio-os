from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any


class WorkflowEventType(str, Enum):
    """Events emitted by workflow execution."""

    STARTED = "workflow.started"
    NODE_STARTED = "workflow.node_started"
    NODE_COMPLETED = "workflow.node_completed"
    NODE_FAILED = "workflow.node_failed"
    COMPLETED = "workflow.completed"
    CANCELLED = "workflow.cancelled"
    ROLLED_BACK = "workflow.rolled_back"


@dataclass(slots=True)
class WorkflowEvent:
    """Structured workflow event payload."""

    type: WorkflowEventType
    workflow_id: str
    node_id: str | None = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    payload: dict[str, Any] = field(default_factory=dict)

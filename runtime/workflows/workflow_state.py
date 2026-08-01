from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from runtime.workflows.workflow_types import WorkflowStatus


@dataclass(slots=True)
class WorkflowExecutionState:
    """Mutable execution state for a workflow."""

    workflow_id: str
    status: WorkflowStatus = WorkflowStatus.IDLE
    started_at: datetime | None = None
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    ended_at: datetime | None = None
    current_node: str | None = None
    completed_nodes: set[str] = field(default_factory=set)
    failed_nodes: set[str] = field(default_factory=set)
    outputs: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    checkpoints: list[str] = field(default_factory=list)

    def touch(self) -> None:
        self.updated_at = datetime.now(UTC)

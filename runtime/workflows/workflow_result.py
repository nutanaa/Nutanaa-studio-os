from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from runtime.workflows.workflow_types import WorkflowStatus


@dataclass(slots=True)
class WorkflowResult:
    """Result of a workflow execution."""

    workflow_id: str
    status: WorkflowStatus
    outputs: dict[str, Any] = field(default_factory=dict)
    executed_nodes: list[str] = field(default_factory=list)
    failed_nodes: list[str] = field(default_factory=list)
    duration_seconds: float = 0.0
    error: str | None = None

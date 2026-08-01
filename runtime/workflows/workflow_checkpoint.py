from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any


@dataclass(slots=True)
class WorkflowCheckpoint:
    """Snapshot of a workflow state."""

    checkpoint_id: str
    workflow_id: str
    state: dict[str, Any]
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

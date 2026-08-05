from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

from runtime.tasks.execution_result import TaskExecutionResult


@dataclass(slots=True)
class ExecutionSession:
    """Identity and lifecycle wrapper around a single orchestrated execution.

    `TaskExecutionEngine`'s own `TaskExecutionState`/`TaskExecutionResult`
    already track everything about *how* an execution ran (stage, attempts,
    provider/agent/model, duration). What they deliberately don't carry is
    *who asked* and *from where* — a session/workspace identity that a
    multi-request IDE session needs to correlate work. That's the only new
    concern this class adds; it does not duplicate execution state.
    """

    session_id: str
    workspace_id: str | None
    execution_id: str = field(default_factory=lambda: uuid4().hex)
    started_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = None
    result: TaskExecutionResult | None = None

    def mark_completed(self, result: TaskExecutionResult) -> None:
        """Record the terminal result and completion time for this session."""
        self.result = result
        self.completed_at = datetime.now(UTC)

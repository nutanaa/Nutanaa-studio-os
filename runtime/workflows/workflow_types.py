from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Awaitable, Callable, Mapping, Protocol

if False:  # pragma: no cover
    from runtime.workflows.workflow_context import WorkflowContext


class WorkflowStatus(str, Enum):
    """Execution status for workflows."""

    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class WorkflowNodeType(str, Enum):
    """Supported workflow node kinds."""

    AGENT = "agent"
    PROVIDER = "provider"
    PLUGIN = "plugin"
    FUNCTION = "function"
    SUB_WORKFLOW = "sub_workflow"
    DECISION = "decision"
    DELAY = "delay"
    LOOP = "loop"
    MERGE = "merge"


WorkflowAction = Callable[["WorkflowContext", Mapping[str, Any]], Any | Awaitable[Any]]
WorkflowCondition = Callable[
    ["WorkflowContext", Mapping[str, Any]],
    bool | Awaitable[bool],
]


@dataclass(slots=True)
class WorkflowRetryPolicy:
    """Retry policy for workflow nodes."""

    max_attempts: int = 1
    delay_seconds: float = 0.0
    backoff_factor: float = 1.0

    def delay_for_attempt(self, attempt: int) -> float:
        """Return the delay before the given retry attempt."""
        if attempt <= 1:
            return 0.0
        return self.delay_seconds * (self.backoff_factor ** (attempt - 1))


class SupportsWorkflowExecution(Protocol):
    """Protocol for executable workflow objects."""

    async def start(self) -> None: ...

    async def pause(self) -> None: ...

    async def resume(self) -> None: ...

    async def cancel(self) -> None: ...

    async def execute_step(self, step_name: str, **kwargs: Any) -> Any: ...

    async def rollback(self) -> None: ...

    async def save_state(self) -> dict[str, Any]: ...

    async def load_state(self, state: dict[str, Any]) -> None: ...

    async def status(self) -> str: ...

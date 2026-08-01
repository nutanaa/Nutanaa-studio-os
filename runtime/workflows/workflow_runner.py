from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

from runtime.events.event_bus import EventBus
from runtime.workflows.workflow_checkpoint import WorkflowCheckpoint
from runtime.workflows.workflow_context import WorkflowContext
from runtime.workflows.workflow_executor import WorkflowExecutor
from runtime.workflows.workflow_graph import WorkflowGraph
from runtime.workflows.workflow_history import WorkflowHistory
from runtime.workflows.workflow_result import WorkflowResult
from runtime.workflows.workflow_retry import WorkflowRetryPolicy
from runtime.workflows.workflow_state import WorkflowExecutionState
from runtime.workflows.workflow_types import WorkflowStatus


@dataclass(slots=True)
class WorkflowRunner:
    """High-level workflow runner with checkpoint support."""

    graph: WorkflowGraph
    context: WorkflowContext
    state: WorkflowExecutionState = field(init=False)
    executor: WorkflowExecutor = field(default_factory=WorkflowExecutor)
    history: WorkflowHistory = field(default_factory=WorkflowHistory)
    retry_policy: WorkflowRetryPolicy = field(default_factory=WorkflowRetryPolicy)
    checkpoints: list[WorkflowCheckpoint] = field(default_factory=list)
    event_bus: EventBus | None = None
    _cancel_event: asyncio.Event = field(default_factory=asyncio.Event, init=False)

    def __post_init__(self) -> None:
        self.state = WorkflowExecutionState(workflow_id=self.graph.workflow_id)

    async def run(self) -> WorkflowResult:
        """Run the full workflow graph."""
        self._cancel_event.clear()
        checkpoint = self.snapshot("before-run")
        self.checkpoints.append(checkpoint)
        self.state.checkpoints.append(checkpoint.checkpoint_id)
        return await self.executor.execute(
            self.graph,
            self.context,
            self.state,
            self.history,
            event_bus=self.event_bus,
            retry_policy=self.retry_policy,
            cancel_event=self._cancel_event,
        )

    async def execute_step(self, step_name: str, **kwargs: Any) -> Any:
        """Execute a single workflow node."""
        checkpoint = self.snapshot(f"before-step:{step_name}")
        self.checkpoints.append(checkpoint)
        self.state.checkpoints.append(checkpoint.checkpoint_id)
        return await self.executor.execute_node(
            self.graph,
            step_name,
            self.context,
            self.state,
            self.history,
            event_bus=self.event_bus,
            retry_policy=self.retry_policy,
            inputs=kwargs or None,
        )

    async def pause(self) -> None:
        self.state.status = WorkflowStatus.PAUSED
        self.state.touch()

    async def resume(self) -> None:
        self.state.status = WorkflowStatus.RUNNING
        self.state.touch()

    async def cancel(self) -> None:
        self._cancel_event.set()
        self.state.status = WorkflowStatus.CANCELLED
        self.state.touch()

    async def rollback(self) -> None:
        if not self.checkpoints:
            self.state.status = WorkflowStatus.ROLLED_BACK
            return
        checkpoint = self.checkpoints[-1]
        self.state = WorkflowExecutionState(
            workflow_id=self.graph.workflow_id,
            status=WorkflowStatus.ROLLED_BACK,
        )
        self.state.outputs = dict(checkpoint.state.get("outputs", {}))
        self.state.metadata = dict(checkpoint.state.get("metadata", {}))
        self.state.completed_nodes = set(checkpoint.state.get("completed_nodes", []))
        self.state.failed_nodes = set(checkpoint.state.get("failed_nodes", []))
        self.state.checkpoints = list(checkpoint.state.get("checkpoints", []))
        self.state.touch()

    def snapshot(self, checkpoint_id: str) -> WorkflowCheckpoint:
        """Create a state checkpoint."""
        return WorkflowCheckpoint(
            checkpoint_id=checkpoint_id,
            workflow_id=self.graph.workflow_id,
            state={
                "status": self.state.status.value,
                "outputs": dict(self.state.outputs),
                "metadata": dict(self.state.metadata),
                "completed_nodes": sorted(self.state.completed_nodes),
                "failed_nodes": sorted(self.state.failed_nodes),
                "checkpoints": list(self.state.checkpoints),
            },
        )

    def serialise_state(self) -> dict[str, Any]:
        return {
            "state": {
                "status": self.state.status.value,
                "outputs": dict(self.state.outputs),
                "metadata": dict(self.state.metadata),
                "completed_nodes": sorted(self.state.completed_nodes),
                "failed_nodes": sorted(self.state.failed_nodes),
                "checkpoints": list(self.state.checkpoints),
            }
        }

    def deserialise_state(self, payload: dict[str, Any]) -> None:
        state = payload.get("state", {})
        self.state.status = WorkflowStatus(
            state.get("status", WorkflowStatus.IDLE.value)
        )
        self.state.outputs = dict(state.get("outputs", {}))
        self.state.metadata = dict(state.get("metadata", {}))
        self.state.completed_nodes = set(state.get("completed_nodes", []))
        self.state.failed_nodes = set(state.get("failed_nodes", []))
        self.state.checkpoints = list(state.get("checkpoints", []))
        self.state.touch()

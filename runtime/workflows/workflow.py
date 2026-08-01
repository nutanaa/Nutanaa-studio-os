from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from runtime.contracts.i_workflow import IWorkflow
from runtime.workflows.workflow_builder import WorkflowBuilder
from runtime.workflows.workflow_context import WorkflowContext
from runtime.workflows.workflow_graph import WorkflowGraph
from runtime.workflows.workflow_runner import WorkflowRunner
from runtime.workflows.workflow_state import WorkflowExecutionState
from runtime.workflows.workflow_types import WorkflowStatus


@dataclass(slots=True)
class Workflow(IWorkflow):
    """Concrete workflow implementation."""

    workflow_id: str
    context: WorkflowContext
    graph: WorkflowGraph = field(default_factory=lambda: WorkflowGraph("workflow"))
    runner: WorkflowRunner = field(init=False)

    def __post_init__(self) -> None:
        if self.graph.workflow_id == "workflow":
            self.graph.workflow_id = self.workflow_id
        self.runner = WorkflowRunner(graph=self.graph, context=self.context)

    @classmethod
    def builder(cls, workflow_id: str, context: WorkflowContext) -> WorkflowBuilder:
        return WorkflowBuilder(workflow_id=workflow_id, context=context)

    async def start(self) -> None:
        await self.runner.run()

    async def pause(self) -> None:
        await self.runner.pause()

    async def resume(self) -> None:
        await self.runner.resume()

    async def cancel(self) -> None:
        await self.runner.cancel()

    async def execute_step(self, step_name: str, **kwargs: Any) -> Any:
        return await self.runner.execute_step(step_name, **kwargs)

    async def rollback(self) -> None:
        await self.runner.rollback()

    async def save_state(self) -> dict[str, Any]:
        return self.runner.serialise_state()

    async def load_state(self, state: dict[str, Any]) -> None:
        self.runner.deserialise_state(state)

    async def status(self) -> str:
        return self.runner.state.status.value

    @property
    def state(self) -> WorkflowExecutionState:
        return self.runner.state

    @property
    def execution_status(self) -> WorkflowStatus:
        return self.runner.state.status

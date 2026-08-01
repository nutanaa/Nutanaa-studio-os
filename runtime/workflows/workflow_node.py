from __future__ import annotations

import inspect
from dataclasses import dataclass, field
from typing import Any, Mapping

from runtime.workflows.workflow_types import (
    WorkflowAction,
    WorkflowCondition,
    WorkflowNodeType,
)

if False:  # pragma: no cover
    from runtime.workflows.workflow_context import WorkflowContext


@dataclass(slots=True)
class WorkflowNode:
    """Executable workflow node."""

    node_id: str
    name: str
    node_type: WorkflowNodeType
    action: WorkflowAction | None = None
    dependencies: tuple[str, ...] = field(default_factory=tuple)
    condition: WorkflowCondition | None = None
    timeout_seconds: float | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def is_ready(self, completed_nodes: Mapping[str, Any]) -> bool:
        """Return whether all dependencies have produced outputs."""
        return all(dependency in completed_nodes for dependency in self.dependencies)

    async def should_run(
        self,
        context: "WorkflowContext",
        inputs: Mapping[str, Any],
    ) -> bool:
        """Evaluate the node condition, if one exists."""
        if self.condition is None:
            return True
        result = self.condition(context, inputs)
        if inspect.isawaitable(result):
            result = await result
        return bool(result)

    async def execute(
        self,
        context: "WorkflowContext",
        inputs: Mapping[str, Any],
    ) -> Any:
        """Execute the node action."""
        if self.action is None:
            return dict(inputs)
        result = self.action(context, inputs)
        if inspect.isawaitable(result):
            result = await result
        return result

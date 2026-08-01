from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from runtime.workflows.workflow_context import WorkflowContext
from runtime.workflows.workflow_graph import WorkflowGraph
from runtime.workflows.workflow_node import WorkflowNode
from runtime.workflows.workflow_runner import WorkflowRunner
from runtime.workflows.workflow_types import WorkflowNodeType


@dataclass(slots=True)
class WorkflowBuilder:
    """Fluent workflow builder."""

    workflow_id: str
    context: WorkflowContext
    _graph: WorkflowGraph = field(init=False)

    def __post_init__(self) -> None:
        self._graph = WorkflowGraph(workflow_id=self.workflow_id)

    def add_node(
        self,
        node_id: str,
        name: str,
        node_type: WorkflowNodeType,
        action: Any | None = None,
        *,
        dependencies: tuple[str, ...] = (),
        metadata: dict[str, Any] | None = None,
    ) -> "WorkflowBuilder":
        self._graph.add_node(
            WorkflowNode(
                node_id=node_id,
                name=name,
                node_type=node_type,
                action=action,
                dependencies=dependencies,
                metadata=dict(metadata or {}),
            )
        )
        return self

    def add_edge(self, source: str, target: str) -> "WorkflowBuilder":
        self._graph.add_edge(source, target)
        return self

    def build(self) -> WorkflowRunner:
        return WorkflowRunner(graph=self._graph, context=self.context)

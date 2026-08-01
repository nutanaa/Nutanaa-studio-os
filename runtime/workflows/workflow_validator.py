from __future__ import annotations

from runtime.workflows.workflow_exceptions import WorkflowGraphError
from runtime.workflows.workflow_graph import WorkflowGraph


class WorkflowValidator:
    """Validates workflow graphs."""

    def validate(self, graph: WorkflowGraph) -> None:
        if not graph.nodes:
            raise WorkflowGraphError("Workflow graph is empty.")
        graph.validate()

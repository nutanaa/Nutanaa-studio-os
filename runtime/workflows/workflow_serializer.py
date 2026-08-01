from __future__ import annotations

from typing import Any

from runtime.workflows.workflow_checkpoint import WorkflowCheckpoint
from runtime.workflows.workflow_graph import WorkflowGraph
from runtime.workflows.workflow_state import WorkflowExecutionState


class WorkflowSerializer:
    """Serialises workflow objects to dictionaries."""

    def graph_to_dict(self, graph: WorkflowGraph) -> dict[str, Any]:
        return {
            "workflow_id": graph.workflow_id,
            "nodes": [
                {
                    "node_id": node.node_id,
                    "name": node.name,
                    "node_type": node.node_type.value,
                    "dependencies": list(node.dependencies),
                    "metadata": dict(node.metadata),
                    "timeout_seconds": node.timeout_seconds,
                }
                for node in graph.nodes.values()
            ],
            "edges": [
                {"source": edge.source, "target": edge.target} for edge in graph.edges
            ],
        }

    def state_to_dict(self, state: WorkflowExecutionState) -> dict[str, Any]:
        return {
            "workflow_id": state.workflow_id,
            "status": state.status.value,
            "started_at": state.started_at.isoformat() if state.started_at else None,
            "updated_at": state.updated_at.isoformat(),
            "ended_at": state.ended_at.isoformat() if state.ended_at else None,
            "current_node": state.current_node,
            "completed_nodes": sorted(state.completed_nodes),
            "failed_nodes": sorted(state.failed_nodes),
            "outputs": dict(state.outputs),
            "metadata": dict(state.metadata),
            "checkpoints": list(state.checkpoints),
        }

    def checkpoint_to_dict(self, checkpoint: WorkflowCheckpoint) -> dict[str, Any]:
        return {
            "checkpoint_id": checkpoint.checkpoint_id,
            "workflow_id": checkpoint.workflow_id,
            "state": dict(checkpoint.state),
            "created_at": checkpoint.created_at.isoformat(),
        }

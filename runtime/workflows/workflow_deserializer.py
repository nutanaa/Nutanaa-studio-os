from __future__ import annotations

from datetime import datetime
from typing import Any

from runtime.workflows.workflow_checkpoint import WorkflowCheckpoint
from runtime.workflows.workflow_graph import WorkflowGraph
from runtime.workflows.workflow_node import WorkflowNode
from runtime.workflows.workflow_state import WorkflowExecutionState
from runtime.workflows.workflow_types import WorkflowNodeType, WorkflowStatus


class WorkflowDeserializer:
    """Restores workflow objects from dictionaries."""

    def graph_from_dict(self, payload: dict[str, Any]) -> WorkflowGraph:
        graph = WorkflowGraph(workflow_id=payload["workflow_id"])
        for node_payload in payload.get("nodes", []):
            node = WorkflowNode(
                node_id=node_payload["node_id"],
                name=node_payload["name"],
                node_type=WorkflowNodeType(node_payload["node_type"]),
                dependencies=tuple(node_payload.get("dependencies", [])),
                metadata=dict(node_payload.get("metadata", {})),
                timeout_seconds=node_payload.get("timeout_seconds"),
            )
            graph.add_node(node)
        for edge_payload in payload.get("edges", []):
            graph.add_edge(edge_payload["source"], edge_payload["target"])
        return graph

    def state_from_dict(self, payload: dict[str, Any]) -> WorkflowExecutionState:
        state = WorkflowExecutionState(
            workflow_id=payload["workflow_id"],
            status=WorkflowStatus(payload.get("status", WorkflowStatus.IDLE.value)),
        )
        started_at = payload.get("started_at")
        updated_at = payload.get("updated_at")
        ended_at = payload.get("ended_at")
        if started_at:
            state.started_at = datetime.fromisoformat(started_at)
        if updated_at:
            state.updated_at = datetime.fromisoformat(updated_at)
        if ended_at:
            state.ended_at = datetime.fromisoformat(ended_at)
        state.current_node = payload.get("current_node")
        state.completed_nodes = set(payload.get("completed_nodes", []))
        state.failed_nodes = set(payload.get("failed_nodes", []))
        state.outputs = dict(payload.get("outputs", {}))
        state.metadata = dict(payload.get("metadata", {}))
        state.checkpoints = list(payload.get("checkpoints", []))
        return state

    def checkpoint_from_dict(self, payload: dict[str, Any]) -> WorkflowCheckpoint:
        return WorkflowCheckpoint(
            checkpoint_id=payload["checkpoint_id"],
            workflow_id=payload["workflow_id"],
            state=dict(payload["state"]),
        )

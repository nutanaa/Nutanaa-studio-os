from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, field, replace

from runtime.workflows.workflow_edge import WorkflowEdge
from runtime.workflows.workflow_exceptions import WorkflowGraphError
from runtime.workflows.workflow_node import WorkflowNode


@dataclass(slots=True)
class WorkflowGraph:
    """Directed acyclic workflow graph."""

    workflow_id: str
    nodes: dict[str, WorkflowNode] = field(default_factory=dict)
    edges: list[WorkflowEdge] = field(default_factory=list)

    def add_node(self, node: WorkflowNode) -> None:
        """Add a node to the graph."""
        self.nodes[node.node_id] = node

    def add_edge(self, source: str, target: str) -> None:
        """Add a directed edge."""
        if source not in self.nodes or target not in self.nodes:
            raise WorkflowGraphError(
                f"Cannot add edge {source!r} -> {target!r}; node missing."
            )
        node = self.nodes[target]
        if source not in node.dependencies:
            self.nodes[target] = replace(
                node,
                dependencies=node.dependencies + (source,),
            )
        self.edges.append(WorkflowEdge(source=source, target=target))

    def dependencies_of(self, node_id: str) -> tuple[str, ...]:
        """Return dependency ids for a node."""
        return self.nodes[node_id].dependencies

    def dependents_of(self, node_id: str) -> tuple[str, ...]:
        """Return dependent node ids."""
        return tuple(edge.target for edge in self.edges if edge.source == node_id)

    def validate(self) -> None:
        """Validate the graph structure."""
        missing: list[str] = []
        for node in self.nodes.values():
            for dependency in node.dependencies:
                if dependency not in self.nodes:
                    missing.append(f"{node.node_id}->{dependency}")
        if missing:
            raise WorkflowGraphError(
                "Missing dependencies: " + ", ".join(sorted(missing))
            )
        self.topological_layers()

    def topological_layers(self) -> list[list[str]]:
        """Return node ids grouped by execution layer."""
        indegree: dict[str, int] = {node_id: 0 for node_id in self.nodes}
        adjacency: dict[str, list[str]] = defaultdict(list)
        for node in self.nodes.values():
            for dependency in node.dependencies:
                adjacency[dependency].append(node.node_id)
                indegree[node.node_id] = indegree.get(node.node_id, 0) + 1

        queue = deque([node_id for node_id, degree in indegree.items() if degree == 0])
        layers: list[list[str]] = []
        visited = 0
        while queue:
            layer: list[str] = []
            for _ in range(len(queue)):
                node_id = queue.popleft()
                layer.append(node_id)
                visited += 1
                for child in adjacency.get(node_id, []):
                    indegree[child] -= 1
                    if indegree[child] == 0:
                        queue.append(child)
            layers.append(layer)
        if visited != len(self.nodes):
            raise WorkflowGraphError("Workflow graph contains a cycle.")
        return layers

    def __len__(self) -> int:
        return len(self.nodes)

from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True, frozen=True)
class WorkflowEdge:
    """Directed connection between workflow nodes."""

    source: str
    target: str

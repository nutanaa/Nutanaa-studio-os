from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from runtime.agents.agent_types import AgentPriority


@dataclass(slots=True)
class AgentTask:
    """Scheduled unit of work for an agent."""

    task_id: str
    agent_name: str
    input_data: Any = None
    priority: AgentPriority = field(default_factory=AgentPriority)
    metadata: dict[str, Any] = field(default_factory=dict)

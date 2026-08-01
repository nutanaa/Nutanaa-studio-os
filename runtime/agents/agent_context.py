from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from runtime.agents.agent_memory import AgentMemory
from runtime.agents.agent_state import AgentState

if TYPE_CHECKING:  # pragma: no cover
    from runtime.runtime_context import RuntimeContext


@dataclass(slots=True)
class AgentContext:
    """Execution context for an agent."""

    agent_name: str
    runtime: "RuntimeContext | None" = None
    state: AgentState = field(init=False)
    memory: AgentMemory = field(default_factory=AgentMemory)
    variables: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.state = AgentState(agent_name=self.agent_name)

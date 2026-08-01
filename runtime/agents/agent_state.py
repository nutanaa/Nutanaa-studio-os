from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from runtime.agents.agent_types import AgentStatus


@dataclass(slots=True)
class AgentState:
    """Mutable agent state."""

    agent_name: str
    status: AgentStatus = AgentStatus.IDLE
    current_task: str | None = None
    last_input: Any = None
    last_output: Any = None
    started_at: datetime | None = None
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    ended_at: datetime | None = None
    errors: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def touch(self) -> None:
        self.updated_at = datetime.now(UTC)

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from runtime.agents.agent_types import AgentStatus


@dataclass(slots=True)
class AgentResult:
    """Result of an agent execution."""

    agent_name: str
    status: AgentStatus
    output: Any = None
    error: str | None = None
    started_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    ended_at: datetime | None = None

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any


class AgentEventType(str, Enum):
    """Events emitted by agent orchestration."""

    STARTED = "agent.started"
    COMPLETED = "agent.completed"
    FAILED = "agent.failed"


@dataclass(slots=True)
class AgentEvent:
    """Structured agent event."""

    type: AgentEventType
    agent_name: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    payload: dict[str, Any] = field(default_factory=dict)

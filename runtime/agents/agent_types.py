from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Awaitable, Callable

if False:  # pragma: no cover
    from runtime.agents.agent_context import AgentContext


class AgentStatus(str, Enum):
    """Agent execution states."""

    IDLE = "idle"
    INITIALISING = "initialising"
    READY = "ready"
    RUNNING = "running"
    PAUSED = "paused"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass(slots=True)
class AgentPriority:
    """Priority wrapper for scheduled agent tasks."""

    value: int = 0


AgentHandler = Callable[["AgentContext", Any], Any | Awaitable[Any]]
AgentValidator = Callable[["AgentContext"], bool | Awaitable[bool]]
AgentStatusProvider = Callable[[], str | Awaitable[str]]

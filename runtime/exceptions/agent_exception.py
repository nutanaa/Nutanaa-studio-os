"""Agent-related runtime exceptions."""

from __future__ import annotations

from runtime.exceptions.base_exception import NutanaaBaseException


class AgentException(NutanaaBaseException):
    """Raised for agent lifecycle or execution failures."""

    def __init__(self, message: str, code: str = "AGENT_ERROR") -> None:
        super().__init__(message, code)


class AgentNotFoundError(AgentException):
    """Raised when a requested agent is not registered."""

    def __init__(self, name: str) -> None:
        super().__init__(f"Agent not found: '{name}'", "AGENT_NOT_FOUND")
        self.name = name


class AgentInitError(AgentException):
    """Raised when an agent fails to initialise."""

    def __init__(self, name: str, reason: str) -> None:
        super().__init__(
            f"Agent '{name}' failed to initialise: {reason}",
            "AGENT_INIT_ERROR",
        )
        self.name = name
        self.reason = reason


class AgentExecutionError(AgentException):
    """Raised when agent execution fails."""

    def __init__(self, name: str, reason: str) -> None:
        super().__init__(
            f"Agent '{name}' execution error: {reason}",
            "AGENT_EXECUTION_ERROR",
        )
        self.name = name
        self.reason = reason

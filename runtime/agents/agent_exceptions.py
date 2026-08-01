from __future__ import annotations


class AgentFrameworkError(RuntimeError):
    """Base error for agent framework operations."""


class AgentRegistryError(AgentFrameworkError):
    """Raised when agent registry operations fail."""


class AgentSchedulerError(AgentFrameworkError):
    """Raised when agent scheduling fails."""


class AgentValidationError(AgentFrameworkError):
    """Raised when an agent fails validation."""

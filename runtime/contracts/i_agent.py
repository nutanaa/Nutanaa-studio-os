from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class IAgent(ABC):
    """Abstract interface for agents.

    Implementations define the lifecycle and execution behavior of runtime
    agents without coupling the runtime package to any specific agent.
    """

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize agent resources and prepare execution state."""

    @abstractmethod
    async def execute(self, input_data: Any) -> Any:
        """Execute the agent against the provided input payload."""

    @abstractmethod
    async def validate(self) -> None:
        """Validate the agent configuration and readiness."""

    @abstractmethod
    async def cancel(self) -> None:
        """Cancel any in-flight execution for the agent."""

    @abstractmethod
    async def pause(self) -> None:
        """Pause the agent execution if supported."""

    @abstractmethod
    async def resume(self) -> None:
        """Resume the agent execution after pausing."""

    @abstractmethod
    async def status(self) -> str:
        """Return the current execution status of the agent."""

    @abstractmethod
    async def shutdown(self) -> None:
        """Release resources and complete the agent lifecycle."""

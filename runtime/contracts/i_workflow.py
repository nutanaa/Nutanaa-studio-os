from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class IWorkflow(ABC):
    """Abstract interface for workflows.

    Implementations define the execution lifecycle of workflow graphs and
    persistence behavior without depending on any concrete workflow engine.
    """

    @abstractmethod
    async def start(self) -> None:
        """Start the workflow execution."""

    @abstractmethod
    async def pause(self) -> None:
        """Pause the workflow execution if supported."""

    @abstractmethod
    async def resume(self) -> None:
        """Resume the workflow execution after pausing."""

    @abstractmethod
    async def cancel(self) -> None:
        """Cancel the workflow execution."""

    @abstractmethod
    async def execute_step(self, step_name: str, **kwargs: Any) -> Any:
        """Execute a single workflow step with optional parameters."""

    @abstractmethod
    async def rollback(self) -> None:
        """Rollback the workflow to a safe or prior state."""

    @abstractmethod
    async def save_state(self) -> dict[str, Any]:
        """Persist and return the current workflow state."""

    @abstractmethod
    async def load_state(self, state: dict[str, Any]) -> None:
        """Restore workflow state from persisted data."""

    @abstractmethod
    async def status(self) -> str:
        """Return the current workflow status."""

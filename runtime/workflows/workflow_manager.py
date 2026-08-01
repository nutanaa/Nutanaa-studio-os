from __future__ import annotations

import logging
from threading import RLock
from typing import Any

from runtime.constants import (
    WORKFLOW_STATUS_CANCELLED,
    WORKFLOW_STATUS_COMPLETED,
    WORKFLOW_STATUS_FAILED,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_PENDING,
    WORKFLOW_STATUS_ROLLED_BACK,
    WORKFLOW_STATUS_RUNNING,
)
from runtime.contracts.i_workflow import IWorkflow
from runtime.exceptions.workflow_exception import (
    WorkflowNotFoundError,
    WorkflowRollbackError,
    WorkflowStepError,
)

logger = logging.getLogger(__name__)


class WorkflowManager:
    """Manages workflow registration, execution, state, and rollback."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._workflows: dict[str, IWorkflow] = {}
        self._statuses: dict[str, str] = {}
        self._states: dict[str, dict[str, Any]] = {}

    def register(self, name: str, workflow: IWorkflow) -> None:
        """Register a workflow instance."""
        with self._lock:
            self._workflows[name] = workflow
            self._statuses[name] = WORKFLOW_STATUS_PENDING
        logger.info("Registered workflow: '%s'", name)

    def unregister(self, name: str) -> None:
        """Remove a workflow from the registry."""
        with self._lock:
            self._workflows.pop(name, None)
            self._statuses.pop(name, None)
            self._states.pop(name, None)
        logger.info("Unregistered workflow: '%s'", name)

    def get(self, name: str) -> IWorkflow:
        """Return a workflow by name."""
        with self._lock:
            wf = self._workflows.get(name)
        if wf is None:
            raise WorkflowNotFoundError(name)
        return wf

    def list_workflows(self) -> list[str]:
        """Return all registered workflow names."""
        with self._lock:
            return list(self._workflows.keys())

    async def start(self, name: str) -> None:
        """Start a workflow."""
        wf = self.get(name)
        await wf.start()
        with self._lock:
            self._statuses[name] = WORKFLOW_STATUS_RUNNING
        logger.info("Started workflow: '%s'", name)

    async def pause(self, name: str) -> None:
        """Pause a running workflow."""
        wf = self.get(name)
        await wf.pause()
        with self._lock:
            self._statuses[name] = WORKFLOW_STATUS_PAUSED
        logger.info("Paused workflow: '%s'", name)

    async def resume(self, name: str) -> None:
        """Resume a paused workflow."""
        wf = self.get(name)
        await wf.resume()
        with self._lock:
            self._statuses[name] = WORKFLOW_STATUS_RUNNING
        logger.info("Resumed workflow: '%s'", name)

    async def cancel(self, name: str) -> None:
        """Cancel a workflow."""
        wf = self.get(name)
        await wf.cancel()
        with self._lock:
            self._statuses[name] = WORKFLOW_STATUS_CANCELLED
        logger.info("Cancelled workflow: '%s'", name)

    async def execute_step(self, name: str, step_name: str, **kwargs: Any) -> Any:
        """Execute a single step within a workflow."""
        wf = self.get(name)
        try:
            with self._lock:
                self._statuses[name] = WORKFLOW_STATUS_RUNNING
            result = await wf.execute_step(step_name, **kwargs)
            logger.debug("Workflow '%s' step '%s' completed", name, step_name)
            with self._lock:
                self._statuses[name] = WORKFLOW_STATUS_COMPLETED
            return result
        except Exception as exc:
            with self._lock:
                self._statuses[name] = WORKFLOW_STATUS_FAILED
            raise WorkflowStepError(name, step_name, str(exc)) from exc

    async def rollback(self, name: str) -> None:
        """Roll back a workflow to a prior safe state."""
        wf = self.get(name)
        try:
            await wf.rollback()
            with self._lock:
                self._statuses[name] = WORKFLOW_STATUS_ROLLED_BACK
            logger.info("Rolled back workflow: '%s'", name)
        except Exception as exc:
            with self._lock:
                self._statuses[name] = WORKFLOW_STATUS_FAILED
            raise WorkflowRollbackError(name, str(exc)) from exc

    async def save_state(self, name: str) -> dict[str, Any]:
        """Persist and return the current state of a workflow."""
        wf = self.get(name)
        state = await wf.save_state()
        with self._lock:
            self._states[name] = state
        logger.debug("Saved state for workflow: '%s'", name)
        return state

    async def load_state(self, name: str, state: dict[str, Any]) -> None:
        """Restore a workflow from previously persisted state."""
        wf = self.get(name)
        await wf.load_state(state)
        with self._lock:
            self._states[name] = state
        logger.debug("Loaded state for workflow: '%s'", name)

    async def status(self, name: str) -> str:
        """Return the current status of a workflow."""
        wf = self.get(name)
        try:
            return await wf.status()
        except Exception:  # pragma: no cover - fallback path
            with self._lock:
                return self._statuses.get(name, WORKFLOW_STATUS_PENDING)

    async def cancel_all(self) -> None:
        """Cancel every registered workflow."""
        for name in self.list_workflows():
            await self.cancel(name)

    async def status_all(self) -> dict[str, str]:
        """Return the status of every registered workflow."""
        result: dict[str, str] = {}
        for name in self.list_workflows():
            result[name] = await self.status(name)
        return result

    def statuses(self) -> dict[str, str]:
        """Return a copy of the current workflow statuses."""
        with self._lock:
            return dict(self._statuses)

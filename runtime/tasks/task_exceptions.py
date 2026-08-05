from __future__ import annotations

from runtime.exceptions.runtime_exception import RuntimeException


class TaskExecutionError(RuntimeException):
    """Base error for task execution failures."""


class TaskCancelledError(TaskExecutionError):
    """Raised when a task execution is cancelled."""


class TaskTimeoutError(TaskExecutionError):
    """Raised when a task execution exceeds its timeout."""


class TaskPlanError(TaskExecutionError):
    """Raised when task planning or resolution fails."""

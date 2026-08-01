from __future__ import annotations


class WorkflowFrameworkError(RuntimeError):
    """Base error for workflow framework operations."""


class WorkflowGraphError(WorkflowFrameworkError):
    """Raised when a workflow graph is invalid."""


class WorkflowExecutionError(WorkflowFrameworkError):
    """Raised when workflow execution fails."""


class WorkflowSerializationError(WorkflowFrameworkError):
    """Raised when workflow serialization fails."""


class WorkflowCheckpointError(WorkflowFrameworkError):
    """Raised when checkpoint operations fail."""


class WorkflowRollbackError(WorkflowFrameworkError):
    """Raised when rollback operations fail."""

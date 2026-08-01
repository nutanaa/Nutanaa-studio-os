"""Workflow-related runtime exceptions."""

from __future__ import annotations

from runtime.exceptions.base_exception import NutanaaBaseException


class WorkflowException(NutanaaBaseException):
    """Raised for workflow lifecycle or execution failures."""

    def __init__(self, message: str, code: str = "WORKFLOW_ERROR") -> None:
        super().__init__(message, code)


class WorkflowNotFoundError(WorkflowException):
    """Raised when a requested workflow is not registered."""

    def __init__(self, name: str) -> None:
        super().__init__(f"Workflow not found: '{name}'", "WORKFLOW_NOT_FOUND")
        self.name = name


class WorkflowStepError(WorkflowException):
    """Raised when a workflow step fails."""

    def __init__(self, workflow: str, step: str, reason: str) -> None:
        super().__init__(
            f"Workflow '{workflow}' step '{step}' failed: {reason}",
            "WORKFLOW_STEP_ERROR",
        )
        self.workflow = workflow
        self.step = step
        self.reason = reason


class WorkflowRollbackError(WorkflowException):
    """Raised when a workflow rollback cannot be completed."""

    def __init__(self, name: str, reason: str) -> None:
        super().__init__(
            f"Workflow '{name}' rollback failed: {reason}",
            "WORKFLOW_ROLLBACK_ERROR",
        )
        self.name = name
        self.reason = reason

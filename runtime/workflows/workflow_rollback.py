from __future__ import annotations

from dataclasses import dataclass

from runtime.workflows.workflow_checkpoint import WorkflowCheckpoint
from runtime.workflows.workflow_runner import WorkflowRunner


@dataclass(slots=True)
class WorkflowRollbackManager:
    """Rollback helper for workflow runners."""

    runner: WorkflowRunner

    def restore(self, checkpoint: WorkflowCheckpoint) -> None:
        self.runner.deserialise_state({"state": checkpoint.state})

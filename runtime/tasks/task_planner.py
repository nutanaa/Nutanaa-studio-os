from __future__ import annotations

from runtime.tasks.execution_context import ExecutionContext
from runtime.tasks.execution_request import ExecutionRequest
from runtime.tasks.task_exceptions import TaskPlanError


class TaskPlanner:
    """Default task planner used by the execution pipeline."""

    async def plan(
        self,
        request: ExecutionRequest,
        context: ExecutionContext,
    ) -> ExecutionRequest:
        """Validate and normalize a task request before execution."""
        if request.agent_name is None and request.capability is None:
            raise TaskPlanError(
                "Task request must specify either an agent or a provider capability."
            )
        if request.max_attempts < 1:
            raise TaskPlanError("max_attempts must be at least 1.")
        return request

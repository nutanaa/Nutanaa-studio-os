from __future__ import annotations

from dataclasses import dataclass

from runtime.orchestration.execution_session import ExecutionSession
from runtime.tasks.execution_request import ExecutionRequest
from runtime.tasks.execution_result import TaskExecutionResult
from runtime.tasks.task_execution_engine import TaskExecutionEngine


@dataclass(slots=True)
class ExecutionOrchestrator:
    """Single entry point for every AI execution in Nutanaa Studio OS.

    This deliberately wraps a real `TaskExecutionEngine` rather than
    reimplementing planning, staging, retries, or telemetry — those already
    exist there and are already verified to work end-to-end (see
    `backend/api/main.py`'s `chat-assistant` path). This class's only job is
    the thing that's actually missing: giving each execution a session
    identity, and being the one call site that FastAPI endpoints (and later,
    workflows/multi-agent coordination) go through instead of reaching into
    `AgentManager`/`ProviderManager` directly.

    This is intentionally the *only* new addition in this slice. Multi-agent
    coordination policy (single/parallel/sequential/delegation) and
    persistence are separate, later slices — see the conversation history
    for why bundling them in here would mean shipping unverified code.
    """

    engine: TaskExecutionEngine

    async def execute(
        self,
        request: ExecutionRequest,
        *,
        session_id: str,
        workspace_id: str | None = None,
    ) -> tuple[ExecutionSession, TaskExecutionResult]:
        """Run `request` through the real execution engine, wrapped in a
        session. Returns the session (for correlation/logging by the
        caller) alongside the engine's own real result — this method does
        not alter, retry, or reinterpret what the engine returns.
        """
        session = ExecutionSession(session_id=session_id, workspace_id=workspace_id)
        result = await self.engine.execute(request)
        session.mark_completed(result)
        return session, result

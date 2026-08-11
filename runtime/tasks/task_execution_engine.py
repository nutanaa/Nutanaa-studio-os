from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from runtime.agents.agent_manager import AgentManager
from runtime.events.event_bus import EventBus
from runtime.exceptions.agent_exception import AgentNotFoundError
from runtime.providers.provider_manager import ProviderManager, ProviderSelection
from runtime.providers.provider_request import ProviderRequest
from runtime.services.state_store import StateStore
from runtime.services.telemetry_service import TelemetryService
from runtime.tasks.execution_context import ExecutionContext
from runtime.tasks.execution_event import (
    TaskExecutionEventType,
    TaskExecutionStage,
    TaskExecutionStatus,
)
from runtime.tasks.execution_request import ExecutionRequest
from runtime.tasks.execution_result import TaskExecutionResult
from runtime.tasks.execution_state import TaskExecutionState
from runtime.tasks.task_exceptions import (
    TaskCancelledError,
    TaskExecutionError,
    TaskTimeoutError,
)
from runtime.planning.planning_engine import PlanningEngine
from runtime.tasks.task_planner import TaskPlanner
from runtime.tasks.task_selectors import AgentSelector, ModelSelector, ProviderSelector
from runtime.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass(slots=True)
class TaskExecutionEngine:
    """Orchestrates task planning, provider selection, execution, and state."""

    provider_manager: ProviderManager
    agent_manager: AgentManager
    event_bus: EventBus
    state_store: StateStore
    telemetry: TelemetryService
    planner: TaskPlanner = TaskPlanner()
    planning_engine: PlanningEngine = PlanningEngine()
    agent_selector: AgentSelector | None = None
    provider_selector: ProviderSelector | None = None
    model_selector: ModelSelector | None = None
    default_timeout: float = 30.0

    def __post_init__(self) -> None:
        if self.agent_selector is None:
            self.agent_selector = AgentSelector()
        if self.provider_selector is None:
            self.provider_selector = ProviderSelector(self.provider_manager)
        if self.model_selector is None:
            self.model_selector = ModelSelector()
        if self.planning_engine is None:
            self.planning_engine = PlanningEngine()

    async def execute(
        self,
        request: ExecutionRequest,
        *,
        cancel_event: asyncio.Event | None = None,
    ) -> TaskExecutionResult:
        state = TaskExecutionState(
            started_at=datetime.now(UTC),
            status=TaskExecutionStatus.RUNNING,
            stage=TaskExecutionStage.PLANNING,
        )
        self._publish_state(request, state)
        await self._emit_event(
            TaskExecutionEventType.STARTED,
            request,
            {"task_type": request.task_type, "task_id": request.task_id},
        )

        backoff = request.retry_backoff_seconds
        last_error: Exception | None = None
        attempts = max(1, request.max_attempts)

        for attempt in range(1, attempts + 1):
            state.attempts = attempt
            self._publish_state(request, state)
            try:
                if request.timeout_seconds is not None:
                    result = await asyncio.wait_for(
                        self._run_pipeline(request, state, cancel_event),
                        request.timeout_seconds,
                    )
                else:
                    result = await self._run_pipeline(request, state, cancel_event)
                state.status = TaskExecutionStatus.COMPLETED
                state.ended_at = datetime.now(UTC)
                state.result = result
                state.error = None
                state.stage = TaskExecutionStage.COMPLETED
                self._publish_state(request, state)
                await self._emit_event(
                    TaskExecutionEventType.COMPLETED,
                    request,
                    {
                        "attempts": state.attempts,
                        "provider_name": state.provider_name,
                        "agent_name": state.agent_name,
                        "model_name": state.model_name,
                    },
                )
                await self.telemetry.track_event(
                    "TaskExecutionCompleted",
                    {
                        "request_id": request.request_id,
                        "task_type": request.task_type,
                        "status": state.status.value,
                        "duration_seconds": self._duration_seconds(state),
                    },
                )
                await self.telemetry.track_metric(
                    "task_execution.duration_seconds",
                    self._duration_seconds(state),
                )
                return TaskExecutionResult(
                    request_id=request.request_id,
                    task_id=request.task_id,
                    status=state.status,
                    result=result,
                    error=None,
                    provider_name=state.provider_name,
                    provider_id=state.provider_id,
                    agent_name=state.agent_name,
                    model_name=state.model_name,
                    duration_seconds=self._duration_seconds(state),
                    attempts=state.attempts,
                )
            except asyncio.TimeoutError as exc:
                state.status = TaskExecutionStatus.FAILED
                state.stage = TaskExecutionStage.FAILED
                state.ended_at = datetime.now(UTC)
                state.error = str(exc)
                self._publish_state(request, state)
                await self._emit_event(
                    TaskExecutionEventType.FAILED,
                    request,
                    {
                        "reason": "timeout",
                        "attempt": attempt,
                        "timeout_seconds": request.timeout_seconds,
                    },
                )
                await self.telemetry.track_event(
                    "TaskExecutionTimeout",
                    {
                        "request_id": request.request_id,
                        "task_type": request.task_type,
                        "timeout_seconds": request.timeout_seconds,
                    },
                )
                raise TaskTimeoutError(
                    f"Task execution timed out after {request.timeout_seconds} seconds."
                ) from exc
            except TaskCancelledError as exc:
                state.status = TaskExecutionStatus.CANCELLED
                state.stage = TaskExecutionStage.CANCELLED
                state.cancelled = True
                state.ended_at = datetime.now(UTC)
                state.error = str(exc)
                self._publish_state(request, state)
                await self._emit_event(
                    TaskExecutionEventType.CANCELLED,
                    request,
                    {"attempt": attempt, "reason": str(exc)},
                )
                raise
            except Exception as exc:
                last_error = exc
                state.status = TaskExecutionStatus.FAILED
                state.stage = TaskExecutionStage.FAILED
                state.error = str(exc)
                state.ended_at = datetime.now(UTC)
                self._publish_state(request, state)
                await self._emit_event(
                    TaskExecutionEventType.FAILED,
                    request,
                    {
                        "reason": str(exc),
                        "attempt": attempt,
                        "retry_remaining": attempts - attempt,
                    },
                )
                if attempt >= attempts or self._should_not_retry(exc):
                    await self.telemetry.track_event(
                        "TaskExecutionFailed",
                        {
                            "request_id": request.request_id,
                            "task_type": request.task_type,
                            "error": str(exc),
                        },
                    )
                    raise TaskExecutionError(str(exc)) from exc
                await asyncio.sleep(min(backoff, request.max_retry_delay))
                backoff = min(request.max_retry_delay, backoff * 2)

        raise TaskExecutionError(
            f"Task execution failed after {attempts} attempts."
        )

    async def _run_pipeline(
        self,
        request: ExecutionRequest,
        state: TaskExecutionState,
        cancel_event: asyncio.Event | None,
    ) -> Any:
        self._assert_not_cancelled(cancel_event, request)
        context = self._build_context(request)

        plan = await self._run_stage(
            TaskExecutionStage.PLANNING,
            self.planning_engine.create_plan,
            request,
            context,
        )
        context.plan = plan
        if plan.selected_agents:
            request.agent_name = request.agent_name or plan.selected_agents[0]
        if request.agent_name is None and plan.selected_providers:
            request.provider_name = request.provider_name or plan.selected_providers[0]
        if request.model is None and plan.selected_models:
            request.model = plan.selected_models[0]

        self._assert_not_cancelled(cancel_event, request)
        agent_name = await self._run_stage(
            TaskExecutionStage.AGENT_SELECTION,
            self.agent_selector.select,
            request,
            context,
        )
        state.agent_name = agent_name
        self._publish_state(request, state)

        provider_selection = None
        model_name = None
        if agent_name is None:
            self._assert_not_cancelled(cancel_event, request)
            provider_selection = await self._run_stage(
                TaskExecutionStage.PROVIDER_SELECTION,
                self.provider_selector.select,
                request,
                context,
            )
            state.provider_name = provider_selection.name
            state.provider_id = provider_selection.record.metadata.provider_id
            self._publish_state(request, state)

            self._assert_not_cancelled(cancel_event, request)
            model_name = await self._run_stage(
                TaskExecutionStage.MODEL_SELECTION,
                self.model_selector.select,
                request,
                provider_selection,
            )
            state.model_name = model_name
            self._publish_state(request, state)

        self._assert_not_cancelled(cancel_event, request)
        result = await self._run_stage(
            TaskExecutionStage.EXECUTION,
            self._execute_request,
            request,
            context,
            agent_name,
            provider_selection,
            model_name,
        )
        return result

    async def _run_stage(
        self,
        stage: TaskExecutionStage,
        func: Callable[..., Awaitable[Any]],
        *args: Any,
    ) -> Any:
        request = args[0] if args else None
        if isinstance(request, ExecutionRequest):
            self._publish_stage(request, stage, "started")
        result = await func(*args)
        if isinstance(request, ExecutionRequest):
            self._publish_stage(request, stage, "completed")
        return result

    def _build_context(self, request: ExecutionRequest) -> ExecutionContext:
        return ExecutionContext(
            request=request,
            provider_manager=self.provider_manager,
            agent_manager=self.agent_manager,
            event_bus=self.event_bus,
            state_store=self.state_store,
            telemetry=self.telemetry,
            plugin_manager=None,
            planner=self.planner,
            agent_selector=self.agent_selector,
            provider_selector=self.provider_selector,
            model_selector=self.model_selector,
        )

    async def _execute_request(
        self,
        request: ExecutionRequest,
        context: ExecutionContext,
        agent_name: str | None,
        provider_selection: ProviderSelection | None,
        model_name: str | None,
    ) -> Any:
        if agent_name is not None:
            try:
                return await self.agent_manager.execute(agent_name, request.input_data)
            except AgentNotFoundError:
                logger.warning(
                    "Selected agent '%s' not registered; falling back to provider execution.",
                    agent_name,
                )
                agent_name = None

        provider_request = ProviderRequest(
            capability=request.capability,
            prompt=str(request.prompt or request.input_data or ""),
            operation=request.operation,
            provider_name=request.provider_name,
            model=model_name,
            context=dict(request.metadata),
            options={**request.options, **({"model": model_name} if model_name else {})},
            metadata=dict(request.metadata),
            cache_key=request.metadata.get("cache_key"),
            cache_ttl_seconds=request.metadata.get("cache_ttl_seconds"),
        )

        if provider_selection is not None:
            provider = provider_selection.record.provider
            if ProviderCapability.STREAM in provider.metadata.capabilities:
                try:
                    full_text = ""
                    async for chunk in self.provider_manager.stream(
                        prompt=provider_request.prompt,
                        preferred=provider_selection.name,
                        model=model_name,
                    ):
                        await self._emit_event(
                            TaskExecutionEventType.STREAM_CHUNK,
                            request,
                            {"chunk": chunk},
                        )
                        full_text += chunk
                    return full_text
                except Exception:
                    pass

        response = await self.provider_manager.execute(provider_request)
        if not response.success:
            raise TaskExecutionError(
                response.error or "Provider returned unsuccessful response."
            )
        return response.result

    def _publish_state(self, request: ExecutionRequest, state: TaskExecutionState) -> None:
        base_key = f"task_execution.{request.request_id}"
        self.state_store.set(f"{base_key}.status", state.status.value)
        self.state_store.set(f"{base_key}.stage", state.stage.value)
        self.state_store.set(f"{base_key}.provider_name", state.provider_name)
        self.state_store.set(f"{base_key}.provider_id", state.provider_id)
        self.state_store.set(f"{base_key}.agent_name", state.agent_name)
        self.state_store.set(f"{base_key}.model_name", state.model_name)
        self.state_store.set(f"{base_key}.attempts", state.attempts)
        self.state_store.set(f"{base_key}.error", state.error)
        self.state_store.set(f"{base_key}.cancelled", state.cancelled)
        self.state_store.set(
            f"{base_key}.updated_at",
            state.updated_at.isoformat(),
        )

    async def _emit_event(
        self,
        event_type: TaskExecutionEventType,
        request: ExecutionRequest,
        payload: dict[str, Any] | None = None,
    ) -> None:
        await self.event_bus.emit(
            event_type.value,
            "TaskExecutionEngine",
            payload or {},
            subject_id=request.request_id,
        )

    def _publish_stage(
        self,
        request: ExecutionRequest,
        stage: TaskExecutionStage,
        status: str,
    ) -> None:
        self.state_store.set(
            f"task_execution.{request.request_id}.stage",
            stage.value,
        )
        self.state_store.set(
            f"task_execution.{request.request_id}.last_stage_status",
            status,
        )

    def _assert_not_cancelled(
        self,
        cancel_event: asyncio.Event | None,
        request: ExecutionRequest,
    ) -> None:
        if cancel_event is not None and cancel_event.is_set():
            raise TaskCancelledError(f"Task execution '{request.request_id}' was cancelled.")

    def _should_not_retry(self, exc: BaseException) -> bool:
        return isinstance(exc, (TaskCancelledError, TaskTimeoutError))

    def _duration_seconds(self, state: TaskExecutionState) -> float:
        if state.started_at is None or state.ended_at is None:
            return 0.0
        return (state.ended_at - state.started_at).total_seconds()

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Mapping

from runtime.events.event_bus import Event, EventBus
from runtime.workflows.workflow_context import WorkflowContext
from runtime.workflows.workflow_event import WorkflowEvent, WorkflowEventType
from runtime.workflows.workflow_exceptions import WorkflowExecutionError
from runtime.workflows.workflow_graph import WorkflowGraph
from runtime.workflows.workflow_history import WorkflowHistory, WorkflowHistoryEntry
from runtime.workflows.workflow_result import WorkflowResult
from runtime.workflows.workflow_retry import WorkflowRetryPolicy
from runtime.workflows.workflow_state import WorkflowExecutionState
from runtime.workflows.workflow_types import WorkflowStatus


@dataclass(slots=True)
class WorkflowExecutionContext:
    """Bundle used during workflow execution."""

    graph: WorkflowGraph
    context: WorkflowContext
    state: WorkflowExecutionState
    history: WorkflowHistory
    event_bus: EventBus | None = None
    retry_policy: WorkflowRetryPolicy = field(default_factory=WorkflowRetryPolicy)
    checkpoints: list[str] | None = None

    def __post_init__(self) -> None:
        if self.checkpoints is None:
            self.checkpoints = []


class WorkflowExecutor:
    """Executes workflow graphs layer by layer."""

    def __init__(self) -> None:
        pass

    async def execute(
        self,
        graph: WorkflowGraph,
        context: WorkflowContext,
        state: WorkflowExecutionState,
        history: WorkflowHistory | None = None,
        *,
        event_bus: EventBus | None = None,
        retry_policy: WorkflowRetryPolicy | None = None,
        cancel_event: asyncio.Event | None = None,
    ) -> WorkflowResult:
        history = history or WorkflowHistory()
        retry_policy = retry_policy or WorkflowRetryPolicy()
        state.status = WorkflowStatus.RUNNING
        state.started_at = datetime.now(UTC)
        state.touch()
        if event_bus is not None:
            await self._emit(
                event_bus,
                WorkflowEvent(
                    type=WorkflowEventType.STARTED,
                    workflow_id=graph.workflow_id,
                    payload={"nodes": len(graph.nodes)},
                ),
            )

        started = datetime.now(UTC)
        executed: list[str] = []
        failures: list[str] = []
        results: dict[str, Any] = {}

        try:
            graph.validate()
            layers = graph.topological_layers()
            for layer in layers:
                if cancel_event is not None and cancel_event.is_set():
                    state.status = WorkflowStatus.CANCELLED
                    break
                layer_results = await asyncio.gather(
                    *[
                        self._execute_node(
                            graph=graph,
                            node_id=node_id,
                            context=context,
                            state=state,
                            history=history,
                            event_bus=event_bus,
                            retry_policy=retry_policy,
                            inputs=self._node_inputs(graph, node_id, results),
                        )
                        for node_id in layer
                    ],
                    return_exceptions=True,
                )
                for item in layer_results:
                    if isinstance(item, Exception):
                        raise item
                    node_id, value = item
                    executed.append(node_id)
                    results[node_id] = value
                    state.outputs[node_id] = value
                    state.completed_nodes.add(node_id)
                    state.current_node = node_id
                    state.touch()
        except Exception as exc:
            state.status = WorkflowStatus.FAILED
            state.failed_nodes.update(failures)
            state.ended_at = datetime.now(UTC)
            state.touch()
            if event_bus is not None:
                await self._emit(
                    event_bus,
                    WorkflowEvent(
                        type=WorkflowEventType.NODE_FAILED,
                        workflow_id=graph.workflow_id,
                        node_id=state.current_node,
                        payload={"error": str(exc)},
                    ),
                )
            raise WorkflowExecutionError(str(exc)) from exc

        duration = (datetime.now(UTC) - started).total_seconds()
        if state.status != WorkflowStatus.CANCELLED:
            state.status = WorkflowStatus.COMPLETED
            state.ended_at = datetime.now(UTC)
        state.touch()
        if event_bus is not None:
            await self._emit(
                event_bus,
                WorkflowEvent(
                    type=WorkflowEventType.COMPLETED,
                    workflow_id=graph.workflow_id,
                    payload={"executed_nodes": executed},
                ),
            )
        return WorkflowResult(
            workflow_id=graph.workflow_id,
            status=state.status,
            outputs=results,
            executed_nodes=executed,
            failed_nodes=failures,
            duration_seconds=duration,
        )

    async def execute_node(
        self,
        graph: WorkflowGraph,
        node_id: str,
        context: WorkflowContext,
        state: WorkflowExecutionState,
        history: WorkflowHistory | None = None,
        *,
        event_bus: EventBus | None = None,
        retry_policy: WorkflowRetryPolicy | None = None,
        inputs: Mapping[str, Any] | None = None,
    ) -> Any:
        history = history or WorkflowHistory()
        retry_policy = retry_policy or WorkflowRetryPolicy()
        inputs = inputs or self._node_inputs(graph, node_id, state.outputs)
        node = graph.nodes[node_id]
        if not await node.should_run(context, inputs):
            return None
        state.current_node = node_id
        state.status = WorkflowStatus.RUNNING
        attempts = 0
        last_error: Exception | None = None
        while attempts < max(1, retry_policy.max_attempts):
            attempts += 1
            started = datetime.now(UTC)
            try:
                if event_bus is not None:
                    await self._emit(
                        event_bus,
                        WorkflowEvent(
                            type=WorkflowEventType.NODE_STARTED,
                            workflow_id=graph.workflow_id,
                            node_id=node_id,
                        ),
                    )
                result = await node.execute(context, inputs)
                history.record(
                    WorkflowHistoryEntry(
                        node_id=node_id,
                        started_at=started,
                        ended_at=datetime.now(UTC),
                        success=True,
                        payload={"result": result},
                    )
                )
                if event_bus is not None:
                    await self._emit(
                        event_bus,
                        WorkflowEvent(
                            type=WorkflowEventType.NODE_COMPLETED,
                            workflow_id=graph.workflow_id,
                            node_id=node_id,
                            payload={"result": result},
                        ),
                    )
                state.outputs[node_id] = result
                state.completed_nodes.add(node_id)
                state.touch()
                return result
            except Exception as exc:
                last_error = exc
                history.record(
                    WorkflowHistoryEntry(
                        node_id=node_id,
                        started_at=started,
                        ended_at=datetime.now(UTC),
                        success=False,
                        error=str(exc),
                    )
                )
                if attempts >= retry_policy.max_attempts:
                    state.failed_nodes.add(node_id)
                    state.status = WorkflowStatus.FAILED
                    state.touch()
                    raise WorkflowExecutionError(
                        f"Workflow node '{node_id}' failed: {exc}"
                    ) from exc
                delay = retry_policy.delay_for_attempt(attempts)
                if delay > 0:
                    await asyncio.sleep(delay)
        raise WorkflowExecutionError(
            f"Workflow node '{node_id}' failed after retries: {last_error}"
        )

    async def _execute_node(
        self,
        *,
        graph: WorkflowGraph,
        node_id: str,
        context: WorkflowContext,
        state: WorkflowExecutionState,
        history: WorkflowHistory,
        event_bus: EventBus | None,
        retry_policy: WorkflowRetryPolicy,
        inputs: Mapping[str, Any],
    ) -> tuple[str, Any]:
        value = await self.execute_node(
            graph=graph,
            node_id=node_id,
            context=context,
            state=state,
            history=history,
            event_bus=event_bus,
            retry_policy=retry_policy,
            inputs=inputs,
        )
        return node_id, value

    def _node_inputs(
        self,
        graph: WorkflowGraph,
        node_id: str,
        results: Mapping[str, Any],
    ) -> dict[str, Any]:
        node = graph.nodes[node_id]
        return {
            dependency: results[dependency]
            for dependency in node.dependencies
            if dependency in results
        }

    async def _emit(self, event_bus: EventBus, event: WorkflowEvent) -> None:
        await event_bus.publish(
            Event(
                type=event.type.value,
                source="workflow",
                subject_id=(
                    event.workflow_id if event.node_id is None else event.node_id
                ),
                payload=event.payload,
            )
        )

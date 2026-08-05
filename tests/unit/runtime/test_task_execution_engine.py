import asyncio

from runtime import bootstrap
from runtime.providers import (
    MockProvider,
    ProviderCapability,
    ProviderMetadata,
    ProviderRegistry,
    ProviderType,
)
from runtime.tasks import ExecutionRequest, TaskExecutionStatus


def test_task_execution_engine_runs_provider_request() -> None:
    registry = ProviderRegistry()
    if hasattr(registry, "clear"):
        registry.clear()

    context = bootstrap(log_level="INFO")
    manager = context.provider_manager
    provider = MockProvider(
        ProviderMetadata(
            provider_id="mock",
            name="Mock Provider",
            provider_type=ProviderType.MOCK,
            capabilities=frozenset({ProviderCapability.TEXT}),
            models=("mock-text",),
        )
    )
    manager.register("mock", provider)
    asyncio.run(manager.initialize_all())

    request = ExecutionRequest(
        prompt="hello",
        capability=ProviderCapability.TEXT,
        timeout_seconds=5.0,
    )

    result = asyncio.run(context.kernel.task_execution_engine.execute(request))

    assert result.status == TaskExecutionStatus.COMPLETED
    assert result.result == "mock:hello"
    assert context.kernel.state_store.get(f"task_execution.{request.request_id}.status") == "completed"
    assert context.kernel.state_store.get(f"task_execution.{request.request_id}.attempts") == 1


def test_task_execution_engine_publishes_events() -> None:
    registry = ProviderRegistry()
    if hasattr(registry, "clear"):
        registry.clear()

    context = bootstrap(log_level="INFO")
    manager = context.provider_manager
    provider = MockProvider(
        ProviderMetadata(
            provider_id="mock",
            name="Mock Provider",
            provider_type=ProviderType.MOCK,
            capabilities=frozenset({ProviderCapability.TEXT}),
            models=("mock-text",),
        )
    )
    manager.register("mock", provider)
    asyncio.run(manager.initialize_all())

    received: list[str] = []

    async def handle_event(event):
        received.append(event.type)

    context.event_bus.subscribe("task.execution.completed", handle_event)

    request = ExecutionRequest(
        prompt="world",
        capability=ProviderCapability.TEXT,
        timeout_seconds=5.0,
    )
    asyncio.run(context.kernel.task_execution_engine.execute(request))

    assert "task.execution.completed" in received
    assert context.kernel.state_store.get(f"task_execution.{request.request_id}.stage") == "completed"

from __future__ import annotations

import pytest

from runtime import EventBus, RuntimeKernel, bootstrap
from runtime.services import ServiceRegistry


@pytest.mark.asyncio
async def test_runtime_kernel_start_stop_and_dispose() -> None:
    context = bootstrap(log_level="INFO")
    assert context.kernel is not None
    kernel = context.kernel
    assert kernel.resolve_service("RuntimeKernel") is kernel
    assert kernel.state_store.get("runtime.status") is None

    await kernel.initialize()
    assert kernel.state_store.get("runtime.status") == "initializing"

    await kernel.start()
    assert kernel._running is True
    assert kernel.state_store.get("runtime.status") == "running"
    assert kernel.event_bus.listener_count("*") >= 1

    await kernel.stop()
    assert kernel._running is False
    assert kernel.state_store.get("runtime.status") == "stopped"

    await kernel.dispose()
    assert not context.service_registry.exists("RuntimeKernel")


@pytest.mark.asyncio
async def test_event_bus_once() -> None:
    bus = EventBus()
    received: list[str] = []

    async def handler(event):
        received.append(event.type)

    bus.once("test.once", handler)
    await bus.emit("test.once", "unit-test", {})
    await bus.emit("test.once", "unit-test", {})

    assert received == ["test.once"]

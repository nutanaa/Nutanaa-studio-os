from __future__ import annotations

import pytest

from runtime import Event, EventBus, ProjectState, ProviderRegistry, StateCategory


def test_runtime_package_imports() -> None:
    assert Event is not None
    assert EventBus is not None
    assert ProjectState is not None
    assert ProviderRegistry is not None


@pytest.mark.asyncio
async def test_event_bus_publish_and_history() -> None:
    bus = EventBus()
    received: list[Event] = []

    async def handler(event: Event) -> None:
        received.append(event)

    bus.subscribe("test.event", handler)

    event = await bus.emit(
        event_type="test.event",
        source="unit-test",
        subject_id="subject-1",
        payload={"ok": True},
    )

    assert event.type == "test.event"
    assert event.source == "unit-test"
    assert event.subject_id == "subject-1"
    assert received == [event]
    assert bus.history()[-1] == event


def test_project_state_snapshot_and_restore() -> None:
    state = ProjectState(
        name="project-1",
        category=StateCategory.RUNTIME,
        initial_data={"a": 1},
    )

    snap1 = state.snapshot()
    state.set("b", 2)
    snap2 = state.snapshot()

    assert snap1.version == 0
    assert snap2.version == 1
    assert state.get("b") == 2

    state.restore(snap1)
    assert state.get("a") == 1
    assert state.get("b") is None


def test_provider_registry_smoke() -> None:
    registry = ProviderRegistry()
    registry.unregister_provider("missing")
    assert registry.list_providers() is not None

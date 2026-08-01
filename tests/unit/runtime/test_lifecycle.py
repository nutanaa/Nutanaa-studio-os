from __future__ import annotations

import pytest

from runtime.config.settings import RuntimeSettings
from runtime.context import clear_runtime_context, get_runtime_context
from runtime.dependency.container import DependencyContainer
from runtime.events.event_bus import EventBus
from runtime.lifecycle.runtime_lifecycle import RuntimeLifecycle
from runtime.runtime_context import RuntimeContext
from runtime.services.runtime_diagnostics import RuntimeDiagnostics
from runtime.services.runtime_health import RuntimeHealth
from runtime.services.runtime_metrics import RuntimeMetrics
from runtime.services.service_container import ServiceContainer
from runtime.services.service_registry import ServiceRegistry
from runtime.services.shutdown_hooks import ShutdownHooks
from runtime.services.startup_hooks import StartupHooks
from runtime.state.project_state import ProjectState, StateCategory


class DummyProviderManager:
    def __init__(self, calls: list[str]) -> None:
        self.calls = calls

    async def initialize_all(self) -> None:
        self.calls.append("providers.initialize_all")

    async def shutdown_all(self) -> None:
        self.calls.append("providers.shutdown_all")

    async def health_check_all(self) -> dict[str, bool]:
        self.calls.append("providers.health_check_all")
        return {"provider": True}


class DummyPluginManager:
    def __init__(self, calls: list[str]) -> None:
        self.calls = calls
        self._plugins = ["plugin-a", "plugin-b"]

    def list_plugins(self) -> list[str]:
        return list(self._plugins)

    async def enable(self, name: str) -> None:
        self.calls.append(f"plugins.enable:{name}")

    async def disable(self, name: str) -> None:
        self.calls.append(f"plugins.disable:{name}")

    async def health_check_all(self) -> dict[str, bool]:
        self.calls.append("plugins.health_check_all")
        return {"plugin-a": True, "plugin-b": True}


class DummyAgentManager:
    def __init__(self, calls: list[str]) -> None:
        self.calls = calls

    async def initialize_all(self) -> None:
        self.calls.append("agents.initialize_all")

    async def shutdown_all(self) -> None:
        self.calls.append("agents.shutdown_all")


class DummyWorkflowManager:
    def __init__(self, calls: list[str]) -> None:
        self.calls = calls
        self._workflows = ["workflow-a"]

    def list_workflows(self) -> list[str]:
        return list(self._workflows)

    async def status(self, name: str) -> str:
        self.calls.append(f"workflows.status:{name}")
        return "pending"

    async def cancel(self, name: str) -> None:
        self.calls.append(f"workflows.cancel:{name}")


@pytest.mark.asyncio
async def test_runtime_lifecycle_start_and_shutdown_order() -> None:
    calls: list[str] = []

    context = RuntimeContext(
        settings=RuntimeSettings(),
        container=ServiceContainer(),
        dependencies=DependencyContainer(),
        provider_manager=DummyProviderManager(calls),  # type: ignore[arg-type]
        workflow_manager=DummyWorkflowManager(calls),  # type: ignore[arg-type]
        agent_manager=DummyAgentManager(calls),  # type: ignore[arg-type]
        plugin_manager=DummyPluginManager(calls),  # type: ignore[arg-type]
        event_bus=EventBus(),
        state=ProjectState(name="runtime", category=StateCategory.RUNTIME),
        service_registry=ServiceRegistry(),
        metrics=RuntimeMetrics(),
        health=RuntimeHealth(),
        diagnostics=RuntimeDiagnostics(
            RuntimeMetrics(),
            RuntimeHealth(),
            ServiceRegistry(),
        ),
        startup_hooks=StartupHooks(),
        shutdown_hooks=ShutdownHooks(),
    )

    context.startup_hooks.register(lambda: calls.append("startup.hook"))
    context.shutdown_hooks.register(lambda: calls.append("shutdown.hook"))

    lifecycle = RuntimeLifecycle(context)

    await lifecycle.startup()
    assert lifecycle.is_running is True
    assert get_runtime_context() is context

    await lifecycle.shutdown()
    assert lifecycle.is_running is False

    assert calls == [
        "startup.hook",
        "providers.initialize_all",
        "providers.health_check_all",
        "plugins.enable:plugin-a",
        "plugins.enable:plugin-b",
        "plugins.health_check_all",
        "agents.initialize_all",
        "workflows.status:workflow-a",
        "workflows.cancel:workflow-a",
        "agents.shutdown_all",
        "plugins.disable:plugin-b",
        "plugins.disable:plugin-a",
        "providers.shutdown_all",
        "shutdown.hook",
    ]

    clear_runtime_context()

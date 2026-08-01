from __future__ import annotations

import asyncio

from runtime.agents import (
    AgentOrchestrator,
    AgentRegistry,
    AgentScheduler,
    CallableAgent,
)
from runtime.events.event_bus import EventBus
from runtime.plugins import (
    CallablePlugin,
    PluginLifecycle,
    PluginManifest,
    PluginRegistry,
    PluginRuntime,
)
from runtime.providers.provider_manager import ProviderManager
from runtime.providers.provider_registry import ProviderRegistry
from runtime.runtime_context import RuntimeContext
from runtime.services.runtime_diagnostics import RuntimeDiagnostics
from runtime.services.runtime_health import RuntimeHealth
from runtime.services.runtime_metrics import RuntimeMetrics
from runtime.services.service_container import ServiceContainer
from runtime.services.service_registry import ServiceRegistry
from runtime.services.shutdown_hooks import ShutdownHooks
from runtime.services.startup_hooks import StartupHooks
from runtime.state.project_state import ProjectState, StateCategory
from runtime.workflows import Workflow, WorkflowContext, WorkflowNodeType


def test_end_to_end_agent_workflow_plugin() -> None:
    agent_registry = AgentRegistry()
    agent = CallableAgent(name="echo", execute_hook=lambda input_data: input_data)
    agent_registry.register("echo", agent)
    scheduler = AgentScheduler(agent_registry)
    orchestrator = AgentOrchestrator(
        registry=agent_registry,
        scheduler=scheduler,
        event_bus=EventBus(),
    )

    async def run_agent() -> str:
        result = await orchestrator.run_agent("echo", "hello")
        return str(result.output)

    assert asyncio.run(run_agent()) == "hello"

    plugin_registry = PluginRegistry()
    plugin = CallablePlugin(name="demo", version_value="1.0.0")
    manifest = PluginManifest(name="demo", version="1.0.0")
    lifecycle = PluginLifecycle(plugin_registry)
    asyncio.run(lifecycle.install("demo", plugin, manifest))
    asyncio.run(lifecycle.enable("demo"))
    runtime = PluginRuntime(
        name="demo",
        plugin=plugin,
        manifest=manifest,
        event_bus=EventBus(),
    )
    assert asyncio.run(runtime.health_check()) is True

    workflow_context = WorkflowContext(workflow_id="wf-int")
    workflow = (
        Workflow.builder("wf-int", workflow_context)
        .add_node(
            "step-1",
            "step-1",
            WorkflowNodeType.FUNCTION,
            action=lambda _ctx, _inputs: "done",
        )
        .build()
    )
    result = asyncio.run(workflow.run())
    assert result.outputs["step-1"] == "done"


def test_runtime_context_can_be_built() -> None:
    context = RuntimeContext(
        settings=type("Settings", (), {"log_level": "INFO", "default_provider": ""})(),
        container=ServiceContainer(),
        dependencies=type(
            "Deps",
            (),
            {"register_instance": lambda *args, **kwargs: None},
        )(),
        provider_manager=ProviderManager(ProviderRegistry()),
        workflow_manager=type("WorkflowMgr", (), {})(),
        agent_manager=type("AgentMgr", (), {})(),
        plugin_manager=type("PluginMgr", (), {})(),
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
    assert context.state.name == "runtime"

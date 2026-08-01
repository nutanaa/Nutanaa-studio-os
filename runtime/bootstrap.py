"""Bootstrap entry point for Nutanaa Studio OS runtime."""

from __future__ import annotations

import logging
from typing import Any

from runtime.agents.agent_manager import AgentManager
from runtime.config.loader import ConfigLoader
from runtime.config.settings import RuntimeSettings
from runtime.context import set_runtime_context
from runtime.core.lifecycle_manager import LifecycleManager
from runtime.dependency.container import DependencyContainer
from runtime.events.event_bus import EventBus
from runtime.plugins.plugin_manager import PluginManager
from runtime.providers.provider_manager import ProviderManager
from runtime.providers.provider_registry import ProviderRegistry
from runtime.runtime_context import RuntimeContext as RuntimeRuntimeContext
from runtime.services.runtime_diagnostics import RuntimeDiagnostics
from runtime.services.runtime_health import RuntimeHealth
from runtime.services.runtime_metrics import RuntimeMetrics
from runtime.services.service_container import ServiceContainer
from runtime.services.service_registry import ServiceRegistry
from runtime.services.shutdown_hooks import ShutdownHooks
from runtime.services.startup_hooks import StartupHooks
from runtime.state.project_state import ProjectState, StateCategory
from runtime.utils.logger import configure_logging
from runtime.workflows.workflow_manager import WorkflowManager

logger = logging.getLogger(__name__)

RuntimeContext = RuntimeRuntimeContext


class RuntimeBuilder:
    """Build a fully wired runtime context."""

    def __init__(self, *, dotenv_path: str = ".env") -> None:
        self._dotenv_path = dotenv_path

    def build(self, **config_overrides: Any) -> RuntimeContext:
        return bootstrap(dotenv_path=self._dotenv_path, **config_overrides)


def bootstrap(
    *,
    dotenv_path: str = ".env",
    log_level: str | None = None,
    **config_overrides: Any,
) -> RuntimeContext:
    """Initialise and wire up the Nutanaa Studio OS runtime."""
    configure_logging(log_level)
    logger.info("Bootstrapping Nutanaa Studio OS runtime")

    loader = ConfigLoader(dotenv_path=dotenv_path)
    settings = loader.load(**{k: str(v) for k, v in config_overrides.items()})
    if log_level is not None:
        settings.log_level = log_level.upper()

    container = ServiceContainer()
    dependencies = DependencyContainer()
    service_registry = ServiceRegistry()
    metrics = RuntimeMetrics()
    health = RuntimeHealth()
    diagnostics = RuntimeDiagnostics(metrics, health, service_registry)
    startup_hooks = StartupHooks()
    shutdown_hooks = ShutdownHooks()
    event_bus = EventBus()

    provider_registry = ProviderRegistry()
    provider_manager = ProviderManager(
        registry=provider_registry,
        default_provider=settings.default_provider,
    )
    agent_manager = AgentManager()
    workflow_manager = WorkflowManager()
    plugin_manager = PluginManager()
    state = ProjectState(name="runtime", category=StateCategory.RUNTIME)

    lifecycle_context = RuntimeContext(
        settings=settings,
        container=container,
        dependencies=dependencies,
        provider_manager=provider_manager,
        workflow_manager=workflow_manager,
        agent_manager=agent_manager,
        plugin_manager=plugin_manager,
        event_bus=event_bus,
        state=state,
        service_registry=service_registry,
        metrics=metrics,
        health=health,
        diagnostics=diagnostics,
        startup_hooks=startup_hooks,
        shutdown_hooks=shutdown_hooks,
        lifecycle=None,
        extra={},
    )

    lifecycle = LifecycleManager(lifecycle_context)
    lifecycle_context.lifecycle = lifecycle

    container.register_instance("settings", settings)
    container.register_instance("provider_manager", provider_manager)
    container.register_instance("agent_manager", agent_manager)
    container.register_instance("workflow_manager", workflow_manager)
    container.register_instance("plugin_manager", plugin_manager)
    container.register_instance("runtime_context", lifecycle_context)

    dependencies.register_instance(RuntimeSettings, settings)

    set_runtime_context(lifecycle_context)
    logger.info("Runtime bootstrap complete")
    return lifecycle_context


def bootstrap_runtime(*args: Any, **kwargs: Any) -> RuntimeContext:
    """Compatibility alias for bootstrap."""
    return bootstrap(*args, **kwargs)


def build_runtime(*args: Any, **kwargs: Any) -> RuntimeContext:
    """Compatibility alias for bootstrap."""
    return bootstrap(*args, **kwargs)


def create_runtime(*args: Any, **kwargs: Any) -> RuntimeContext:
    """Compatibility alias for bootstrap."""
    return bootstrap(*args, **kwargs)


def initialize_runtime(*args: Any, **kwargs: Any) -> RuntimeContext:
    """Compatibility alias for bootstrap."""
    return bootstrap(*args, **kwargs)

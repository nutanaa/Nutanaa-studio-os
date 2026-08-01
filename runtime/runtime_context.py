from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from runtime.agents.agent_manager import AgentManager
from runtime.config.settings import RuntimeSettings
from runtime.events.event_bus import EventBus
from runtime.plugins.plugin_manager import PluginManager
from runtime.providers.provider_manager import ProviderManager
from runtime.services.runtime_diagnostics import RuntimeDiagnostics
from runtime.services.runtime_health import RuntimeHealth
from runtime.services.runtime_metrics import RuntimeMetrics
from runtime.services.service_container import ServiceContainer
from runtime.services.service_registry import ServiceRegistry
from runtime.services.shutdown_hooks import ShutdownHooks
from runtime.services.startup_hooks import StartupHooks
from runtime.state.project_state import ProjectState
from runtime.workflows.workflow_manager import WorkflowManager

if TYPE_CHECKING:  # pragma: no cover
    from runtime.core.lifecycle_manager import LifecycleManager
    from runtime.dependency.container import DependencyContainer


@dataclass(slots=True)
class RuntimeContext:
    """Shared runtime context for Nutanaa Studio OS."""

    settings: RuntimeSettings
    container: ServiceContainer
    dependencies: "DependencyContainer"
    provider_manager: ProviderManager
    workflow_manager: WorkflowManager
    agent_manager: AgentManager
    plugin_manager: PluginManager
    event_bus: EventBus
    state: ProjectState
    service_registry: ServiceRegistry
    metrics: RuntimeMetrics
    health: RuntimeHealth
    diagnostics: RuntimeDiagnostics
    startup_hooks: StartupHooks
    shutdown_hooks: ShutdownHooks
    lifecycle: "LifecycleManager | None" = None
    extra: dict[str, Any] = field(default_factory=dict)

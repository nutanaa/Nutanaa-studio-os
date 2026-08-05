from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

from runtime.config.settings import RuntimeSettings
from runtime.core.lifecycle_manager import LifecycleManager
from runtime.events.event_bus import EventBus
from runtime.exceptions.runtime_exception import RuntimeException
from runtime.plugins.plugin_registry import PluginRegistry
from runtime.providers.provider_manager import ProviderManager
from runtime.runtime_context import RuntimeContext
from runtime.services.configuration_manager import ConfigurationManager
from runtime.services.health_monitor import HealthMonitor
from runtime.services.runtime_diagnostics import RuntimeDiagnostics
from runtime.services.runtime_health import RuntimeHealth
from runtime.services.runtime_metrics import RuntimeMetrics
from runtime.services.scheduler import Scheduler
from runtime.services.service_container import ServiceContainer
from runtime.services.service_registry import ServiceRegistry
from runtime.services.shutdown_hooks import ShutdownHooks
from runtime.services.startup_hooks import StartupHooks
from runtime.services.state_store import StateStore
from runtime.services.telemetry_service import TelemetryService
from runtime.state.project_state import ProjectState, StateCategory
from runtime.utils.logger import get_logger

logger = get_logger(__name__)


class KernelError(RuntimeException):
    pass


@dataclass(slots=True)
class RuntimeKernel:
    """Central runtime kernel for Nutanaa Studio OS."""

    settings: RuntimeSettings
    container: ServiceContainer
    dependencies: "runtime.dependency.container.DependencyContainer"
    provider_manager: ProviderManager
    workflow_manager: "runtime.workflows.workflow_manager.WorkflowManager"
    agent_manager: "runtime.agents.agent_manager.AgentManager"
    plugin_manager: "runtime.plugins.plugin_manager.PluginManager"
    event_bus: EventBus
    state: ProjectState
    service_registry: ServiceRegistry
    metrics: RuntimeMetrics
    health: RuntimeHealth
    diagnostics: RuntimeDiagnostics
    startup_hooks: StartupHooks
    shutdown_hooks: ShutdownHooks
    lifecycle: LifecycleManager | None = None
    configuration: ConfigurationManager | None = None
    health_monitor: HealthMonitor | None = None
    scheduler: Scheduler | None = None
    state_store: StateStore | None = None
    telemetry: TelemetryService | None = None
    plugin_registry: PluginRegistry | None = None
    planning_engine: "PlanningEngine" | None = None
    task_execution_engine: "TaskExecutionEngine" | None = None
    _running: bool = False

    @classmethod
    def create(cls, context: RuntimeContext) -> "RuntimeKernel":
        """Create a runtime kernel from an existing runtime context."""
        kernel = cls(
            settings=context.settings,
            container=context.container,
            dependencies=context.dependencies,
            provider_manager=context.provider_manager,
            workflow_manager=context.workflow_manager,
            agent_manager=context.agent_manager,
            plugin_manager=context.plugin_manager,
            event_bus=context.event_bus,
            state=context.state,
            service_registry=context.service_registry,
            metrics=context.metrics,
            health=context.health,
            diagnostics=context.diagnostics,
            startup_hooks=context.startup_hooks,
            shutdown_hooks=context.shutdown_hooks,
            lifecycle=context.lifecycle,
        )
        kernel.configuration = ConfigurationManager(context.settings)
        kernel.health_monitor = HealthMonitor(context.health, context.event_bus)
        kernel.scheduler = Scheduler(context.event_bus)
        kernel.state_store = StateStore(context.event_bus)
        kernel.telemetry = TelemetryService(context.event_bus)
        kernel.plugin_registry = PluginRegistry()
        from runtime.planning.planning_engine import PlanningEngine
        from runtime.tasks.task_execution_engine import TaskExecutionEngine

        kernel.planning_engine = PlanningEngine()
        kernel.task_execution_engine = TaskExecutionEngine(
            provider_manager=context.provider_manager,
            agent_manager=context.agent_manager,
            event_bus=context.event_bus,
            state_store=kernel.state_store,
            telemetry=kernel.telemetry,
            planning_engine=kernel.planning_engine,
        )
        kernel._register_defaults()
        return kernel

    def _register_defaults(self) -> None:
        self.service_registry.register("RuntimeKernel", self)
        self.service_registry.register("ConfigurationManager", self.configuration)
        self.service_registry.register("HealthMonitor", self.health_monitor)
        self.service_registry.register("Scheduler", self.scheduler)
        self.service_registry.register("StateStore", self.state_store)
        self.service_registry.register("TelemetryService", self.telemetry)
        self.service_registry.register("PluginRegistry", self.plugin_registry)
        if self.planning_engine is not None:
            self.service_registry.register("PlanningEngine", self.planning_engine)
        if self.task_execution_engine is not None:
            self.service_registry.register(
                "TaskExecutionEngine",
                self.task_execution_engine,
            )
        logger.debug("Runtime kernel default services registered")

    async def initialize(self) -> None:
        """Initialize the kernel and runtime services."""
        if self._running:
            raise KernelError("Runtime kernel is already initialized.")
        self.event_bus.subscribe("*", self._log_event)
        self.state_store.set("runtime.status", "initializing")
        await self.telemetry.track_event("RuntimeInitialization", {"status": "initializing"})
        logger.info("Runtime kernel initialized")

    async def start(self) -> None:
        """Start the kernel and all registered runtime services."""
        if self._running:
            raise KernelError("Runtime kernel is already running.")
        self.state_store.set("runtime.status", "starting")
        await self._maybe_execute(self.startup_hooks.execute)
        await self.provider_manager.initialize_all()
        provider_health = await self.provider_manager.health_check_all()
        await self.health_monitor.publish("providers", all(provider_health.values()))
        await self.plugin_manager.enable_all()
        plugin_health = await self.plugin_manager.health_check_all()
        await self.health_monitor.publish("plugins", all(plugin_health.values()))
        await self.agent_manager.initialize_all()
        await self.health_monitor.publish("agents", True)
        await self.event_bus.emit("RuntimeStarted", "RuntimeKernel", {"status": "running"})
        self.scheduler.start()
        self.state_store.set("runtime.status", "running")
        self._running = True
        await self.telemetry.track_event("RuntimeStarted")
        logger.info("Runtime kernel started")

    async def stop(self) -> None:
        """Stop the kernel and all registered runtime services."""
        if not self._running:
            raise KernelError("Runtime kernel is not running.")
        self.state_store.set("runtime.status", "stopping")
        for workflow_name in self.workflow_manager.list_workflows():
            try:
                await self.workflow_manager.status(workflow_name)
            except Exception:
                pass
            try:
                await self.workflow_manager.cancel(workflow_name)
            except Exception:
                pass
        await self.agent_manager.shutdown_all()
        await self.plugin_manager.disable_all()
        await self.provider_manager.shutdown_all()
        self.scheduler.stop()
        await self._maybe_execute(self.shutdown_hooks.execute)
        await self.event_bus.emit("RuntimeStopped", "RuntimeKernel", {"status": "stopped"})
        self.state_store.set("runtime.status", "stopped")
        self._running = False
        await self.telemetry.track_event("RuntimeStopped")
        logger.info("Runtime kernel stopped")

    async def restart(self) -> None:
        """Restart the entire runtime kernel."""
        await self.stop()
        await self.start()
        await self.event_bus.emit("RuntimeRestarted", "RuntimeKernel", {})
        logger.info("Runtime kernel restarted")

    async def dispose(self) -> None:
        """Dispose kernel resources and unregister services."""
        if self._running:
            await self.stop()
        self.scheduler.clear()
        self.state_store.clear()
        self.telemetry._hooks.clear()
        self.service_registry.unregister("RuntimeKernel")
        logger.info("Runtime kernel disposed")

    def register_service(self, name: str, service: Any) -> None:
        """Register a runtime service in the service registry."""
        self.service_registry.register(name, service)
        logger.debug("Service registered via kernel: %s", name)

    def resolve_service(self, name: str) -> Any:
        """Resolve a service from the service registry."""
        return self.service_registry.get(name)

    async def _maybe_execute(self, hook: Any) -> None:
        result = hook()
        if asyncio.iscoroutine(result):
            await result

    async def _log_event(self, event: "runtime.events.event_bus.Event") -> None:
        logger.debug("Event emitted: %s %s", event.type, event.payload)

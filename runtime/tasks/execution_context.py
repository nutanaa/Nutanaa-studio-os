from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from runtime.agents.agent_manager import AgentManager
from runtime.events.event_bus import EventBus
from runtime.plugins.plugin_manager import PluginManager
from runtime.providers.provider_manager import ProviderManager
from runtime.services.state_store import StateStore
from runtime.services.telemetry_service import TelemetryService
from runtime.tasks.execution_request import ExecutionRequest

if TYPE_CHECKING:  # pragma: no cover
    from runtime.tasks.task_planner import TaskPlanner
    from runtime.tasks.task_selectors import AgentSelector, ModelSelector, ProviderSelector


@dataclass(slots=True)
class ExecutionContext:
    """Shared execution context for a task request."""

    request: ExecutionRequest
    provider_manager: ProviderManager
    agent_manager: AgentManager
    event_bus: EventBus
    state_store: StateStore
    telemetry: TelemetryService
    plugin_manager: PluginManager | None = None
    variables: dict[str, Any] = field(default_factory=dict)
    planner: "TaskPlanner" | None = None
    agent_selector: "AgentSelector" | None = None
    provider_selector: "ProviderSelector" | None = None
    model_selector: "ModelSelector" | None = None

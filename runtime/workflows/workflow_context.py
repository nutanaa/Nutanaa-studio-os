from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from runtime.agents.agent_manager import AgentManager
from runtime.events.event_bus import EventBus
from runtime.plugins.plugin_manager import PluginManager
from runtime.providers.provider_manager import ProviderManager
from runtime.state.project_state import ProjectState


@dataclass(slots=True)
class WorkflowContext:
    """Execution context for a workflow."""

    workflow_id: str
    provider_manager: ProviderManager | None = None
    agent_manager: AgentManager | None = None
    plugin_manager: PluginManager | None = None
    event_bus: EventBus | None = None
    state: ProjectState | None = None
    variables: dict[str, Any] = field(default_factory=dict)

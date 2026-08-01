from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from runtime.events.event_bus import EventBus
from runtime.plugins.plugin_manifest import PluginManifest

if TYPE_CHECKING:  # pragma: no cover
    from runtime.runtime_context import RuntimeContext


@dataclass(slots=True)
class PluginContext:
    """Execution context passed to plugins."""

    plugin_name: str
    manifest: PluginManifest
    runtime: "RuntimeContext | None" = None
    event_bus: EventBus | None = None
    variables: dict[str, Any] = field(default_factory=dict)

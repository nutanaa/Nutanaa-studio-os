from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from runtime.contracts.i_plugin import IPlugin
from runtime.events.event_bus import Event, EventBus
from runtime.plugins.plugin_context import PluginContext
from runtime.plugins.plugin_manifest import PluginManifest
from runtime.plugins.plugin_types import PluginStatus


@dataclass(slots=True)
class PluginRuntime:
    """Runtime wrapper around a plugin instance."""

    name: str
    plugin: IPlugin
    manifest: PluginManifest
    event_bus: EventBus | None = None
    status: PluginStatus = PluginStatus.DISCOVERED
    context: PluginContext = field(init=False)

    def __post_init__(self) -> None:
        self.context = PluginContext(
            plugin_name=self.name,
            manifest=self.manifest,
            event_bus=self.event_bus,
        )

    async def install(self) -> None:
        await self.plugin.install()
        self.status = PluginStatus.INSTALLED
        await self._emit("plugin.installed", {"plugin": self.name})

    async def enable(self) -> None:
        await self.plugin.enable()
        self.status = PluginStatus.ENABLED
        await self._emit("plugin.enabled", {"plugin": self.name})

    async def disable(self) -> None:
        await self.plugin.disable()
        self.status = PluginStatus.DISABLED
        await self._emit("plugin.disabled", {"plugin": self.name})

    async def uninstall(self) -> None:
        await self.plugin.uninstall()
        self.status = PluginStatus.UNINSTALLED
        await self._emit("plugin.uninstalled", {"plugin": self.name})

    async def health_check(self) -> bool:
        healthy = await self.plugin.health_check()
        await self._emit("plugin.health", {"plugin": self.name, "healthy": healthy})
        return healthy

    async def _emit(self, event_type: str, payload: dict[str, Any]) -> None:
        if self.event_bus is None:
            return
        await self.event_bus.publish(
            Event(
                type=event_type,
                source="plugin",
                subject_id=self.name,
                payload=payload,
            )
        )

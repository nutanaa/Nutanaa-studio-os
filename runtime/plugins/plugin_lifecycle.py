from __future__ import annotations

from dataclasses import dataclass

from runtime.contracts.i_plugin import IPlugin
from runtime.plugins.plugin_manifest import PluginManifest
from runtime.plugins.plugin_registry import PluginRegistry
from runtime.plugins.plugin_types import PluginStatus


@dataclass(slots=True)
class PluginLifecycle:
    """Plugin lifecycle helper."""

    registry: PluginRegistry

    async def install(
        self, name: str, plugin: IPlugin, manifest: PluginManifest
    ) -> None:
        self.registry.register(name, plugin, manifest)
        await plugin.install()
        self.registry.set_status(name, PluginStatus.INSTALLED)

    async def enable(self, name: str) -> None:
        plugin = self.registry.get(name)
        await plugin.enable()
        self.registry.set_status(name, PluginStatus.ENABLED)

    async def disable(self, name: str) -> None:
        plugin = self.registry.get(name)
        await plugin.disable()
        self.registry.set_status(name, PluginStatus.DISABLED)

    async def uninstall(self, name: str) -> None:
        plugin = self.registry.get(name)
        await plugin.uninstall()
        self.registry.set_status(name, PluginStatus.UNINSTALLED)
        self.registry.unregister(name)

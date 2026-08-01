from __future__ import annotations

import logging
from threading import RLock
from typing import Any

from runtime.constants import (
    PLUGIN_STATUS_DISABLED,
    PLUGIN_STATUS_ENABLED,
    PLUGIN_STATUS_INSTALLED,
    PLUGIN_STATUS_UNINSTALLED,
)
from runtime.contracts.i_plugin import IPlugin
from runtime.exceptions.plugin_exception import (
    PluginCompatibilityError,
    PluginInstallError,
    PluginNotFoundError,
)

logger = logging.getLogger(__name__)

_REQUIRED_METADATA_KEYS = {"name", "version"}


class PluginManager:
    """Manages plugin installation, lifecycle, and metadata."""

    def __init__(self, runtime_version: str = "0.1.0") -> None:
        self._lock = RLock()
        self._plugins: dict[str, IPlugin] = {}
        self._statuses: dict[str, str] = {}
        self._runtime_version = runtime_version

    async def install(self, name: str, plugin: IPlugin) -> None:
        """Install and register a plugin."""
        self._validate_compatibility(name, plugin)
        try:
            await plugin.install()
        except Exception as exc:
            raise PluginInstallError(name, str(exc)) from exc

        with self._lock:
            self._plugins[name] = plugin
            self._statuses[name] = PLUGIN_STATUS_INSTALLED
        logger.info("Installed plugin: '%s'", name)

    async def uninstall(self, name: str) -> None:
        """Uninstall and remove a plugin."""
        plugin = self.get(name)
        await plugin.uninstall()
        with self._lock:
            self._plugins.pop(name, None)
            self._statuses[name] = PLUGIN_STATUS_UNINSTALLED
        logger.info("Uninstalled plugin: '%s'", name)

    async def enable(self, name: str) -> None:
        """Enable a registered plugin."""
        plugin = self.get(name)
        await plugin.enable()
        with self._lock:
            self._statuses[name] = PLUGIN_STATUS_ENABLED
        logger.info("Enabled plugin: '%s'", name)

    async def disable(self, name: str) -> None:
        """Disable a registered plugin."""
        plugin = self.get(name)
        await plugin.disable()
        with self._lock:
            self._statuses[name] = PLUGIN_STATUS_DISABLED
        logger.info("Disabled plugin: '%s'", name)

    def get(self, name: str) -> IPlugin:
        """Return a plugin by name."""
        with self._lock:
            plugin = self._plugins.get(name)
        if plugin is None:
            raise PluginNotFoundError(name)
        return plugin

    def list_plugins(self) -> list[str]:
        """Return all registered plugin names."""
        with self._lock:
            return list(self._plugins.keys())

    def metadata(self, name: str) -> dict[str, Any]:
        """Return metadata for a plugin."""
        return self.get(name).metadata()

    def status(self, name: str) -> str:
        """Return the current status string for a plugin."""
        with self._lock:
            return self._statuses.get(name, PLUGIN_STATUS_UNINSTALLED)

    async def health_check(self, name: str) -> bool:
        """Run a health check on a plugin."""
        plugin = self.get(name)
        healthy = await plugin.health_check()
        if not healthy:
            logger.warning("Plugin '%s' health check failed", name)
        return healthy

    async def health_check_all(self) -> dict[str, bool]:
        """Return health status for all registered plugins."""
        results: dict[str, bool] = {}
        for name in self.list_plugins():
            results[name] = await self.health_check(name)
        return results

    async def enable_all(self) -> None:
        """Enable every registered plugin."""
        for name in self.list_plugins():
            await self.enable(name)

    async def disable_all(self) -> None:
        """Disable every registered plugin."""
        for name in reversed(self.list_plugins()):
            await self.disable(name)

    def _validate_compatibility(self, name: str, plugin: IPlugin) -> None:
        """Ensure the plugin meets metadata and compatibility requirements."""
        meta = plugin.metadata()
        missing = _REQUIRED_METADATA_KEYS - set(meta.keys())
        if missing:
            raise PluginCompatibilityError(
                name,
                f"Missing required metadata keys: {', '.join(sorted(missing))}",
            )
        logger.debug("Plugin '%s' passed compatibility check", name)

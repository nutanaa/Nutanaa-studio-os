from __future__ import annotations

import inspect
import logging

from runtime.runtime_context import RuntimeContext

logger = logging.getLogger(__name__)


class StartupManager:
    """Starts runtime services in the correct order."""

    def __init__(self, context: RuntimeContext) -> None:
        self._context = context

    async def start(self) -> None:
        """Run startup hooks and initialise runtime managers."""
        await self._maybe_execute(self._context.startup_hooks.execute)

        logger.info("Starting ProviderManager")
        await self._context.provider_manager.initialize_all()
        provider_health = await self._context.provider_manager.health_check_all()
        self._context.health.providers = all(provider_health.values())

        logger.info("Starting PluginManager")
        for plugin_name in self._context.plugin_manager.list_plugins():
            await self._context.plugin_manager.enable(plugin_name)
        plugin_health = await self._context.plugin_manager.health_check_all()
        self._context.health.plugins = all(plugin_health.values())

        logger.info("Starting AgentManager")
        await self._context.agent_manager.initialize_all()
        self._context.health.agents = True
        self._context.health.workflows = True

    async def _maybe_execute(self, hook: object) -> None:
        result = hook()
        if inspect.isawaitable(result):
            await result

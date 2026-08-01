from __future__ import annotations

import inspect
import logging

from runtime.runtime_context import RuntimeContext

logger = logging.getLogger(__name__)


class ShutdownManager:
    """Stops runtime services in reverse order."""

    def __init__(self, context: RuntimeContext) -> None:
        self._context = context

    async def shutdown(self) -> None:
        """Run shutdown sequence and hooks."""
        for workflow_name in self._context.workflow_manager.list_workflows():
            try:
                await self._context.workflow_manager.status(workflow_name)
            except Exception:  # pragma: no cover - defensive
                pass
            try:
                await self._context.workflow_manager.cancel(workflow_name)
            except Exception:  # pragma: no cover - defensive
                pass

        logger.info("Stopping AgentManager")
        await self._context.agent_manager.shutdown_all()

        logger.info("Stopping PluginManager")
        for plugin_name in reversed(self._context.plugin_manager.list_plugins()):
            await self._context.plugin_manager.disable(plugin_name)

        logger.info("Stopping ProviderManager")
        await self._context.provider_manager.shutdown_all()

        self._context.health.providers = False
        self._context.health.plugins = False
        self._context.health.agents = False
        self._context.health.workflows = False

        await self._maybe_execute(self._context.shutdown_hooks.execute)

    async def _maybe_execute(self, hook: object) -> None:
        result = hook()
        if inspect.isawaitable(result):
            await result

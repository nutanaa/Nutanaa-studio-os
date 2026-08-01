from __future__ import annotations

from runtime.context import clear_runtime_context, set_runtime_context
from runtime.lifecycle.shutdown_manager import ShutdownManager
from runtime.lifecycle.startup_manager import StartupManager
from runtime.runtime_context import RuntimeContext


class RuntimeLifecycle:
    """Runtime lifecycle facade."""

    def __init__(self, context: RuntimeContext) -> None:
        self._context = context
        self._startup = StartupManager(context)
        self._shutdown = ShutdownManager(context)
        self._running = False
        self._context.lifecycle = self

    @property
    def context(self) -> RuntimeContext:
        """Return the bound runtime context."""
        return self._context

    @property
    def is_running(self) -> bool:
        """Return whether the runtime is running."""
        return self._running

    async def startup(self) -> None:
        """Start the runtime."""
        set_runtime_context(self._context)
        await self._startup.start()
        self._context.metrics.mark_startup()
        self._running = True

    async def shutdown(self) -> None:
        """Stop the runtime."""
        await self._shutdown.shutdown()
        self._context.metrics.mark_shutdown()
        self._running = False
        clear_runtime_context()

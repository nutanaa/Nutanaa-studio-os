from __future__ import annotations

from runtime.lifecycle.runtime_lifecycle import RuntimeLifecycle
from runtime.runtime_context import RuntimeContext


class LifecycleManager(RuntimeLifecycle):
    """Compatibility wrapper around :class:`RuntimeLifecycle`."""

    def __init__(self, context: RuntimeContext) -> None:
        super().__init__(context)

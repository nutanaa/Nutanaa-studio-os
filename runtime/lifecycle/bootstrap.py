from __future__ import annotations

from runtime.bootstrap import bootstrap
from runtime.lifecycle.runtime_lifecycle import RuntimeLifecycle


class RuntimeBuilder:
    """Build a runtime lifecycle from the canonical bootstrap path."""

    def build(self) -> RuntimeLifecycle:
        context = bootstrap()
        if context.lifecycle is None:
            raise RuntimeError("bootstrap did not attach a runtime lifecycle")
        return context.lifecycle

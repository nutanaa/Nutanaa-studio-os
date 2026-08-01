from __future__ import annotations

from runtime.runtime_context import RuntimeContext

_runtime_context: RuntimeContext | None = None


def set_runtime_context(context: RuntimeContext) -> None:
    """Set the active runtime context."""
    global _runtime_context
    _runtime_context = context


def get_runtime_context() -> RuntimeContext:
    """Return the active runtime context."""
    if _runtime_context is None:
        raise RuntimeError("Runtime has not been initialized.")
    return _runtime_context


def clear_runtime_context() -> None:
    """Clear the active runtime context."""
    global _runtime_context
    _runtime_context = None

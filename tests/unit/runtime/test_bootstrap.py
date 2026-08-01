from __future__ import annotations

import pytest

from runtime.bootstrap import bootstrap
from runtime.context import clear_runtime_context, get_runtime_context


@pytest.mark.asyncio
async def test_bootstrap_creates_runtime_context() -> None:
    context = bootstrap(log_level="INFO")

    assert context.lifecycle is not None
    assert context.state.name == "runtime"
    assert context.health.healthy is True
    assert get_runtime_context() is context

    await context.lifecycle.startup()
    assert context.lifecycle.is_running is True

    await context.lifecycle.shutdown()
    assert context.lifecycle.is_running is False

    clear_runtime_context()

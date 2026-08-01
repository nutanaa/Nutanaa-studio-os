from __future__ import annotations

import pytest

from runtime.services.runtime_diagnostics import RuntimeDiagnostics
from runtime.services.runtime_health import RuntimeHealth
from runtime.services.runtime_metrics import RuntimeMetrics
from runtime.services.service_registry import ServiceRegistry
from runtime.services.shutdown_hooks import ShutdownHooks
from runtime.services.startup_hooks import StartupHooks


@pytest.mark.asyncio
async def test_startup_and_shutdown_hooks_execute() -> None:
    calls: list[str] = []
    startup = StartupHooks()
    shutdown = ShutdownHooks()

    startup.register(lambda: calls.append("startup-1"))
    startup.register(lambda: calls.append("startup-2"))

    shutdown.register(lambda: calls.append("shutdown-1"))
    shutdown.register(lambda: calls.append("shutdown-2"))

    await startup.execute()
    await shutdown.execute()

    assert calls == [
        "startup-1",
        "startup-2",
        "shutdown-2",
        "shutdown-1",
    ]


def test_service_registry_and_diagnostics() -> None:
    services = ServiceRegistry()
    services.register("alpha", object())
    metrics = RuntimeMetrics()
    health = RuntimeHealth()

    diagnostics = RuntimeDiagnostics(metrics, health, services)
    snapshot = diagnostics.snapshot()

    assert snapshot["health"]["healthy"] is True
    assert "alpha" in snapshot["services"]
    assert snapshot["metrics"]["startup_count"] == 0

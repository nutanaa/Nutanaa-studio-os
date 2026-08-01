from __future__ import annotations

from typing import Any

from runtime.services.runtime_health import RuntimeHealth
from runtime.services.runtime_metrics import RuntimeMetrics
from runtime.services.service_registry import ServiceRegistry


class RuntimeDiagnostics:
    """Collects diagnostic snapshots for the runtime."""

    def __init__(
        self,
        metrics: RuntimeMetrics,
        health: RuntimeHealth,
        services: ServiceRegistry,
    ) -> None:
        self._metrics = metrics
        self._health = health
        self._services = services

    def snapshot(self) -> dict[str, Any]:
        """Return a serialisable diagnostic snapshot."""
        return {
            "health": {
                "providers": self._health.providers,
                "plugins": self._health.plugins,
                "agents": self._health.agents,
                "workflows": self._health.workflows,
                "healthy": self._health.healthy,
            },
            "metrics": {
                "started_at": self._metrics.started_at.isoformat(),
                "startup_count": self._metrics.startup_count,
                "shutdown_count": self._metrics.shutdown_count,
                "provider_requests": self._metrics.provider_requests,
                "agent_runs": self._metrics.agent_runs,
                "workflow_runs": self._metrics.workflow_runs,
                "plugin_calls": self._metrics.plugin_calls,
                "uptime_seconds": self._metrics.uptime_seconds(),
            },
            "services": self._services.list_services(),
        }

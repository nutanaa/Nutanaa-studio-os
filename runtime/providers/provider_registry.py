from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock
from time import perf_counter
from typing import Any

from runtime.providers.provider_capability import ProviderCapability
from runtime.providers.provider_health import HealthStatus, ProviderHealth
from runtime.providers.provider_metadata import ProviderMetadata
from runtime.providers.provider_metrics import ProviderMetrics
from runtime.providers.provider_rate_limiter import ProviderRateLimiter
from runtime.providers.provider_session import ProviderSession


@dataclass(slots=True)
class ProviderRecord:
    """Internal registry entry for a provider."""

    name: str
    provider: Any
    metadata: ProviderMetadata
    health: ProviderHealth = field(default_factory=ProviderHealth)
    metrics: ProviderMetrics = field(default_factory=ProviderMetrics)
    rate_limiter: ProviderRateLimiter = field(default_factory=ProviderRateLimiter)
    session: ProviderSession | None = None
    initialized: bool = False
    last_error: str | None = None

    def supports(self, capability: ProviderCapability | str) -> bool:
        return self.metadata.supports(capability)


class ProviderRegistry:
    """Thread-safe singleton registry for provider instances."""

    _instance: "ProviderRegistry | None" = None
    _lock = RLock()

    def __new__(cls) -> "ProviderRegistry":
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
            return cls._instance

    def __init__(self) -> None:
        if getattr(self, "_initialized", False):
            return
        self._providers: dict[str, ProviderRecord] = {}
        self._initialized = True

    def clear(self) -> None:
        """Remove all provider registrations."""
        with self._lock:
            self._providers.clear()

    def register_provider(
        self,
        name: str,
        provider: Any,
        metadata: ProviderMetadata | None = None,
    ) -> ProviderRecord:
        """Register a provider instance by name."""
        with self._lock:
            resolved_metadata = metadata or self._resolve_metadata(name, provider)
            record = ProviderRecord(
                name=name,
                provider=provider,
                metadata=resolved_metadata,
            )
            self._providers[name] = record
            return record

    def unregister_provider(self, name: str) -> None:
        """Remove a provider instance by name."""
        with self._lock:
            self._providers.pop(name, None)

    def get_provider(self, name: str) -> Any | None:
        """Return a provider instance by name."""
        with self._lock:
            record = self._providers.get(name)
            return None if record is None else record.provider

    def get_record(self, name: str) -> ProviderRecord | None:
        """Return the full provider record by name."""
        with self._lock:
            return self._providers.get(name)

    def list_providers(self) -> list[str]:
        """Return the registered provider names."""
        with self._lock:
            return list(self._providers.keys())

    def list_records(self) -> list[ProviderRecord]:
        """Return a list of provider records."""
        with self._lock:
            return list(self._providers.values())

    def provider_exists(self, name: str) -> bool:
        """Return whether a provider is currently registered."""
        with self._lock:
            return name in self._providers

    def find_by_capability(
        self,
        capability: ProviderCapability | str,
    ) -> list[ProviderRecord]:
        """Return providers advertising a capability."""
        with self._lock:
            records = list(self._providers.values())
        return [record for record in records if record.supports(capability)]

    def find_by_type(self, provider_type: str) -> list[ProviderRecord]:
        """Return providers by type name."""
        with self._lock:
            records = list(self._providers.values())
        return [
            record
            for record in records
            if record.metadata.provider_type.value == provider_type
        ]

    def select_best(
        self,
        capability: ProviderCapability | str,
        preferred: str | None = None,
    ) -> ProviderRecord | None:
        """Select the best provider for a capability."""
        candidates = self.find_by_capability(capability)
        if preferred is not None:
            preferred_record = self.get_record(preferred)
            if preferred_record is not None and preferred_record.supports(capability):
                candidates = [preferred_record] + [
                    record
                    for record in candidates
                    if record.name != preferred_record.name
                ]
        if not candidates:
            return None
        candidates.sort(key=self._selection_key)
        return candidates[0]

    async def health_check_all(self) -> dict[str, bool]:
        """Return health status for all registered providers."""
        with self._lock:
            records = list(self._providers.items())
        results: dict[str, bool] = {}
        for name, record in records:
            health_method = getattr(record.provider, "health_check", None)
            if callable(health_method):
                started = perf_counter()
                try:
                    healthy = await health_method()
                except Exception as exc:  # pragma: no cover - defensive
                    healthy = False
                    record.last_error = str(exc)
                    record.health.mark(
                        HealthStatus.UNHEALTHY,
                        latency_ms=(perf_counter() - started) * 1000,
                        message=str(exc),
                    )
                else:
                    record.health.mark(
                        HealthStatus.HEALTHY if healthy else HealthStatus.UNHEALTHY,
                        latency_ms=(perf_counter() - started) * 1000,
                        message="healthy" if healthy else "unhealthy",
                    )
                results[name] = record.health.healthy
            else:
                record.health.mark(
                    HealthStatus.UNHEALTHY,
                    message="missing health_check",
                )
                results[name] = False
        return results

    def _selection_key(self, record: ProviderRecord) -> tuple[int, float, int]:
        healthy_rank = 0 if record.health.healthy else 1
        latency_rank = record.metrics.average_latency_ms
        failure_rank = record.metrics.failures
        return (healthy_rank, latency_rank, failure_rank)

    def _resolve_metadata(self, name: str, provider: Any) -> ProviderMetadata:
        metadata = getattr(provider, "metadata", None)
        if callable(metadata):
            metadata = metadata()
        if isinstance(metadata, ProviderMetadata):
            return metadata
        provider_id = getattr(provider, "provider_id", name)
        provider_name = getattr(provider, "provider_name", name)
        provider_type = getattr(provider, "provider_type", None)
        provider_type_value = getattr(provider_type, "value", provider_type or "custom")
        capabilities = getattr(provider, "capabilities", frozenset())
        version = getattr(provider, "version", "0.1.0")
        capability_values = [getattr(item, "value", str(item)) for item in capabilities]
        return ProviderMetadata.from_mapping(
            {
                "provider_id": provider_id,
                "name": provider_name,
                "provider_type": provider_type_value,
                "version": version,
                "capabilities": capability_values,
            }
        )

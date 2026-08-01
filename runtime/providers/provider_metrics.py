from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock


@dataclass(slots=True)
class ProviderMetrics:
    """Operational metrics collected for a provider."""

    total_requests: int = 0
    successes: int = 0
    failures: int = 0
    retries: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    _latency_total_ms: float = field(default=0.0, init=False, repr=False)
    _lock: RLock = field(default_factory=RLock, init=False, repr=False)

    def record_request(self) -> None:
        with self._lock:
            self.total_requests += 1

    def record_success(self, latency_ms: float | None = None) -> None:
        with self._lock:
            self.successes += 1
            if latency_ms is not None:
                self._latency_total_ms += latency_ms

    def record_failure(self) -> None:
        with self._lock:
            self.failures += 1

    def record_retry(self) -> None:
        with self._lock:
            self.retries += 1

    def record_cache_hit(self) -> None:
        with self._lock:
            self.cache_hits += 1

    def record_cache_miss(self) -> None:
        with self._lock:
            self.cache_misses += 1

    @property
    def average_latency_ms(self) -> float:
        with self._lock:
            if not self.successes:
                return 0.0
            return self._latency_total_ms / self.successes

    def to_dict(self) -> dict[str, float | int]:
        with self._lock:
            return {
                "total_requests": self.total_requests,
                "successes": self.successes,
                "failures": self.failures,
                "retries": self.retries,
                "cache_hits": self.cache_hits,
                "cache_misses": self.cache_misses,
                "average_latency_ms": self.average_latency_ms,
            }

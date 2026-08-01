from __future__ import annotations

from dataclasses import dataclass
from threading import RLock
from time import monotonic


@dataclass(slots=True)
class RateLimitState:
    tokens: float
    last_refill: float


class ProviderRateLimiter:
    """Simple token-bucket rate limiter."""

    def __init__(self, capacity: float = 10.0, refill_rate: float = 1.0) -> None:
        if capacity <= 0:
            raise ValueError("capacity must be positive")
        if refill_rate <= 0:
            raise ValueError("refill_rate must be positive")
        self.capacity = float(capacity)
        self.refill_rate = float(refill_rate)
        self._lock = RLock()
        self._state = RateLimitState(tokens=self.capacity, last_refill=monotonic())

    def _refill(self) -> None:
        now = monotonic()
        elapsed = now - self._state.last_refill
        if elapsed <= 0:
            return
        new_tokens = elapsed * self.refill_rate
        self._state.tokens = min(self.capacity, self._state.tokens + new_tokens)
        self._state.last_refill = now

    def try_acquire(self, tokens: float = 1.0) -> bool:
        """Attempt to consume tokens without waiting."""
        if tokens <= 0:
            return True
        with self._lock:
            self._refill()
            if self._state.tokens < tokens:
                return False
            self._state.tokens -= tokens
            return True

    def acquire(self, tokens: float = 1.0) -> bool:
        """Compatibility wrapper for token acquisition."""
        return self.try_acquire(tokens)

    @property
    def available_tokens(self) -> float:
        with self._lock:
            self._refill()
            return self._state.tokens

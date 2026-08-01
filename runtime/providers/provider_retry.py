from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import TypeVar

from runtime.providers.provider_exceptions import ProviderRetryExhaustedError

T = TypeVar("T")


@dataclass(slots=True)
class RetryPolicy:
    """Retry policy with exponential backoff."""

    attempts: int = 3
    initial_delay: float = 0.5
    backoff_factor: float = 2.0
    max_delay: float = 8.0
    retryable_exceptions: tuple[type[BaseException], ...] = (
        TimeoutError,
        ConnectionError,
        OSError,
    )

    def should_retry(self, exc: BaseException) -> bool:
        return isinstance(exc, self.retryable_exceptions)

    async def execute(
        self,
        func: Callable[[], Awaitable[T]] | Callable[[], T],
    ) -> T:
        delay = self.initial_delay
        last_exc: BaseException | None = None
        for attempt in range(1, self.attempts + 1):
            try:
                result = func()
                if asyncio.iscoroutine(result):
                    return await result
                return result
            except BaseException as exc:  # pragma: no cover - controlled path
                last_exc = exc
                if attempt >= self.attempts or not self.should_retry(exc):
                    break
                await asyncio.sleep(delay)
                delay = min(self.max_delay, delay * self.backoff_factor)
        raise ProviderRetryExhaustedError(str(last_exc) if last_exc else "retry failed")

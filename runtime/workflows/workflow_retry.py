from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class WorkflowRetryPolicy:
    """Retry policy for workflow node execution."""

    max_attempts: int = 1
    delay_seconds: float = 0.0
    backoff_factor: float = 1.0

    def delay_for_attempt(self, attempt: int) -> float:
        if attempt <= 1:
            return 0.0
        return self.delay_seconds * (self.backoff_factor ** (attempt - 1))

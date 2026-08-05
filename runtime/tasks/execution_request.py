from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from runtime.providers.provider_capability import ProviderCapability


@dataclass(slots=True)
class ExecutionRequest:
    """Normalized request for the runtime task execution pipeline."""

    request_id: str = field(default_factory=lambda: uuid4().hex)
    task_id: str | None = None
    task_type: str = "generic"
    prompt: str = ""
    input_data: Any = None
    capability: ProviderCapability | None = None
    operation: str | None = None
    provider_name: str | None = None
    agent_name: str | None = None
    model: str | None = None
    timeout_seconds: float | None = None
    max_attempts: int = 1
    retry_backoff_seconds: float = 0.5
    max_retry_delay: float = 8.0
    metadata: dict[str, Any] = field(default_factory=dict)
    options: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

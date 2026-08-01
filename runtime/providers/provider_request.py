from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

from runtime.providers.provider_capability import ProviderCapability


@dataclass(slots=True)
class ProviderRequest:
    """A normalised request routed to a provider."""

    capability: ProviderCapability
    prompt: str = ""
    operation: str | None = None
    provider_name: str | None = None
    model: str | None = None
    context: dict[str, object] = field(default_factory=dict)
    options: dict[str, object] = field(default_factory=dict)
    metadata: dict[str, object] = field(default_factory=dict)
    cache_key: str | None = None
    cache_ttl_seconds: float | None = None
    request_id: str = field(default_factory=lambda: uuid4().hex)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

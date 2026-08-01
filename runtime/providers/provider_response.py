from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from runtime.providers.provider_capability import ProviderCapability


@dataclass(slots=True)
class ProviderResponse:
    """Structured response returned by a provider."""

    request_id: str
    provider_id: str
    capability: ProviderCapability
    success: bool
    result: Any = None
    error: str | None = None
    usage: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    model: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    @property
    def text(self) -> str:
        """Return a text representation of the result."""
        if isinstance(self.result, str):
            return self.result
        if self.result is None:
            return ""
        return str(self.result)

    @classmethod
    def ok(
        cls,
        *,
        request_id: str,
        provider_id: str,
        capability: ProviderCapability,
        result: Any,
        usage: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        model: str | None = None,
    ) -> "ProviderResponse":
        """Construct a successful response."""
        return cls(
            request_id=request_id,
            provider_id=provider_id,
            capability=capability,
            success=True,
            result=result,
            usage=dict(usage or {}),
            metadata=dict(metadata or {}),
            model=model,
        )

    @classmethod
    def fail(
        cls,
        *,
        request_id: str,
        provider_id: str,
        capability: ProviderCapability,
        error: str,
        metadata: dict[str, Any] | None = None,
    ) -> "ProviderResponse":
        """Construct a failed response."""
        return cls(
            request_id=request_id,
            provider_id=provider_id,
            capability=capability,
            success=False,
            error=error,
            metadata=dict(metadata or {}),
        )

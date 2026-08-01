from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4


@dataclass(slots=True)
class ProviderSession:
    """Track a provider session across requests."""

    provider_id: str
    session_id: str = field(default_factory=lambda: uuid4().hex)
    started_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    ended_at: datetime | None = None
    context: dict[str, object] = field(default_factory=dict)
    active: bool = True

    def close(self) -> None:
        """Mark the session as closed."""
        self.ended_at = datetime.now(UTC)
        self.active = False

    def touch(self) -> None:
        """Update the session timestamp."""
        self.started_at = datetime.now(UTC)

    def with_context(self, **values: object) -> None:
        """Merge values into the session context."""
        self.context.update(values)

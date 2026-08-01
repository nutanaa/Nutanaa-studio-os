from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class RuntimeHealth:
    """Aggregated runtime health flags."""

    providers: bool = True
    plugins: bool = True
    agents: bool = True
    workflows: bool = True

    @property
    def healthy(self) -> bool:
        """Return whether the runtime is healthy."""
        return self.providers and self.plugins and self.agents and self.workflows

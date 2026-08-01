from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True, frozen=True)
class PluginDependency:
    """Plugin dependency declaration."""

    name: str
    version: str | None = None
    optional: bool = False

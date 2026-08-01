from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(slots=True)
class DiscoveredPlugin:
    """A discovered plugin module."""

    path: str
    module: str


class PluginDiscovery:
    """Discovers plugins in directories."""

    def discover(self, root: str | Path) -> list[DiscoveredPlugin]:
        base = Path(root)
        discovered: list[DiscoveredPlugin] = []
        if not base.exists():
            return discovered
        for path in base.rglob("*.py"):
            if path.name.startswith("_"):
                continue
            discovered.append(DiscoveredPlugin(path=str(path), module=path.stem))
        return discovered

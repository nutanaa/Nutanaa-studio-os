from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from runtime.plugins.plugin_dependency import PluginDependency


@dataclass(slots=True)
class PluginManifest:
    """Static plugin manifest."""

    name: str
    version: str
    description: str = ""
    author: str = ""
    runtime_version: str = "0.1.0"
    dependencies: list[PluginDependency] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

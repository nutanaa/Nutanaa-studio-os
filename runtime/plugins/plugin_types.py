from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class PluginStatus(str, Enum):
    """Plugin lifecycle states."""

    DISCOVERED = "discovered"
    LOADED = "loaded"
    INSTALLED = "installed"
    ENABLED = "enabled"
    DISABLED = "disabled"
    UNINSTALLED = "uninstalled"
    FAILED = "failed"


@dataclass(slots=True)
class PluginDependency:
    """Represents a plugin dependency constraint."""

    name: str
    version: str | None = None
    optional: bool = False


@dataclass(slots=True)
class PluginRuntimeMetadata:
    """Metadata captured at runtime."""

    name: str
    version: str
    description: str = ""
    author: str = ""
    runtime_version: str = "0.1.0"
    dependencies: list[PluginDependency] = field(default_factory=list)
    extras: dict[str, Any] = field(default_factory=dict)

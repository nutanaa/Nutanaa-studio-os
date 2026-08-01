from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class IPlugin(ABC):
    """Abstract interface for plugins.

    Implementations define lifecycle and metadata behavior for runtime
    extensions without coupling the runtime package to concrete plugins.
    """

    @abstractmethod
    async def install(self) -> None:
        """Install the plugin and prepare its runtime resources."""

    @abstractmethod
    async def uninstall(self) -> None:
        """Uninstall the plugin and release its resources."""

    @abstractmethod
    async def enable(self) -> None:
        """Enable the plugin for runtime use."""

    @abstractmethod
    async def disable(self) -> None:
        """Disable the plugin for runtime use."""

    @abstractmethod
    def metadata(self) -> dict[str, Any]:
        """Return plugin metadata such as name, version, and author."""

    @abstractmethod
    def dependencies(self) -> list[str]:
        """Return the plugin dependency identifiers."""

    @abstractmethod
    def version(self) -> str:
        """Return the plugin version string."""

    @abstractmethod
    async def health_check(self) -> bool:
        """Return whether the plugin is healthy and ready for use."""

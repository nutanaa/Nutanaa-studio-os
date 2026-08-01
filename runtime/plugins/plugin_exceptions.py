from __future__ import annotations


class PluginFrameworkError(RuntimeError):
    """Base error for plugin framework operations."""


class PluginManifestError(PluginFrameworkError):
    """Raised when a plugin manifest is invalid."""


class PluginLoaderError(PluginFrameworkError):
    """Raised when a plugin cannot be loaded."""


class PluginRegistryError(PluginFrameworkError):
    """Raised when plugin registry operations fail."""


class PluginRuntimeError(PluginFrameworkError):
    """Raised when a plugin runtime operation fails."""

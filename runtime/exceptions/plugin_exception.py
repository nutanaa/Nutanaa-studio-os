"""Plugin-related runtime exceptions."""

from __future__ import annotations

from runtime.exceptions.base_exception import NutanaaBaseException


class PluginException(NutanaaBaseException):
    """Raised for plugin lifecycle or compatibility failures."""

    def __init__(self, message: str, code: str = "PLUGIN_ERROR") -> None:
        super().__init__(message, code)


class PluginNotFoundError(PluginException):
    """Raised when a requested plugin is not registered."""

    def __init__(self, name: str) -> None:
        super().__init__(f"Plugin not found: '{name}'", "PLUGIN_NOT_FOUND")
        self.name = name


class PluginInstallError(PluginException):
    """Raised when a plugin fails to install."""

    def __init__(self, name: str, reason: str) -> None:
        super().__init__(
            f"Plugin '{name}' install failed: {reason}",
            "PLUGIN_INSTALL_ERROR",
        )
        self.name = name
        self.reason = reason


class PluginCompatibilityError(PluginException):
    """Raised when a plugin is incompatible with the current runtime."""

    def __init__(self, name: str, reason: str) -> None:
        super().__init__(
            f"Plugin '{name}' compatibility error: {reason}",
            "PLUGIN_COMPATIBILITY_ERROR",
        )
        self.name = name
        self.reason = reason

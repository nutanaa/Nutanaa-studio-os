"""Provider-related runtime exceptions."""

from __future__ import annotations

from runtime.exceptions.base_exception import NutanaaBaseException


class ProviderException(NutanaaBaseException):
    """Raised for provider lifecycle or request failures."""

    def __init__(self, message: str, code: str = "PROVIDER_ERROR") -> None:
        super().__init__(message, code)


class ProviderNotFoundError(ProviderException):
    """Raised when a requested provider is not registered."""

    def __init__(self, name: str) -> None:
        super().__init__(f"Provider not found: '{name}'", "PROVIDER_NOT_FOUND")
        self.name = name


class ProviderInitError(ProviderException):
    """Raised when a provider fails to initialise."""

    def __init__(self, name: str, reason: str) -> None:
        super().__init__(
            f"Provider '{name}' failed to initialise: {reason}",
            "PROVIDER_INIT_ERROR",
        )
        self.name = name
        self.reason = reason


class ProviderHealthError(ProviderException):
    """Raised when a provider health check fails."""

    def __init__(self, name: str) -> None:
        super().__init__(
            f"Provider '{name}' failed health check", "PROVIDER_HEALTH_ERROR"
        )
        self.name = name

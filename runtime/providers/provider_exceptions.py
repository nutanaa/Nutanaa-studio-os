from __future__ import annotations

from runtime.exceptions.provider_exception import ProviderException


class ProviderFrameworkError(ProviderException):
    """Base error for provider framework failures."""

    def __init__(self, message: str, code: str = "PROVIDER_FRAMEWORK_ERROR") -> None:
        super().__init__(message, code)


class ProviderRegistrationError(ProviderFrameworkError):
    """Raised when provider registration fails."""

    def __init__(self, name: str, reason: str) -> None:
        super().__init__(
            f"Provider '{name}' registration failed: {reason}",
            "PROVIDER_REGISTRATION_ERROR",
        )
        self.name = name
        self.reason = reason


class ProviderCapabilityError(ProviderFrameworkError):
    """Raised when a provider does not support a requested capability."""

    def __init__(self, provider_id: str, capability: str) -> None:
        super().__init__(
            f"Provider '{provider_id}' does not support capability '{capability}'",
            "PROVIDER_CAPABILITY_ERROR",
        )
        self.provider_id = provider_id
        self.capability = capability


class ProviderSelectionError(ProviderFrameworkError):
    """Raised when the manager cannot select an appropriate provider."""

    def __init__(self, capability: str) -> None:
        super().__init__(
            f"No provider available for capability '{capability}'",
            "PROVIDER_SELECTION_ERROR",
        )
        self.capability = capability


class ProviderConfigurationError(ProviderFrameworkError):
    """Raised when provider configuration is invalid."""

    def __init__(self, provider_id: str, reason: str) -> None:
        super().__init__(
            f"Provider '{provider_id}' has invalid configuration: {reason}",
            "PROVIDER_CONFIGURATION_ERROR",
        )
        self.provider_id = provider_id
        self.reason = reason


class ProviderLoadError(ProviderFrameworkError):
    """Raised when a provider class or module cannot be loaded."""

    def __init__(self, target: str, reason: str) -> None:
        super().__init__(
            f"Unable to load provider '{target}': {reason}",
            "PROVIDER_LOAD_ERROR",
        )
        self.target = target
        self.reason = reason


class ProviderRoutingError(ProviderFrameworkError):
    """Raised when request routing fails."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason, "PROVIDER_ROUTING_ERROR")
        self.reason = reason


class ProviderRateLimitError(ProviderFrameworkError):
    """Raised when provider requests are rate limited."""

    def __init__(self, provider_id: str) -> None:
        super().__init__(
            f"Provider '{provider_id}' is rate limited",
            "PROVIDER_RATE_LIMIT_ERROR",
        )
        self.provider_id = provider_id


class ProviderRetryExhaustedError(ProviderFrameworkError):
    """Raised when provider retries are exhausted."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason, "PROVIDER_RETRY_EXHAUSTED")
        self.reason = reason


class ProviderCacheError(ProviderFrameworkError):
    """Raised when cache operations fail."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason, "PROVIDER_CACHE_ERROR")
        self.reason = reason

from __future__ import annotations

from runtime.exceptions.base_exception import NutanaaBaseException


class DependencyException(NutanaaBaseException):
    """Base exception for dependency resolution failures."""

    def __init__(self, message: str, code: str = "DEPENDENCY_ERROR") -> None:
        super().__init__(message, code)


class ServiceNotRegisteredError(DependencyException):
    """Raised when a requested service is not registered."""

    def __init__(self, service: object) -> None:
        name = getattr(
            service,
            "__qualname__",
            getattr(service, "__name__", str(service)),
        )
        super().__init__(
            f"Service not registered: '{name}'",
            "DEPENDENCY_NOT_REGISTERED",
        )
        self.service = service


class CircularDependencyError(DependencyException):
    """Raised when dependency resolution detects a cycle."""

    def __init__(self, chain: list[str]) -> None:
        super().__init__(
            f"Circular dependency detected: {' -> '.join(chain)}",
            "DEPENDENCY_CIRCULAR",
        )
        self.chain = chain


class DependencyResolutionError(DependencyException):
    """Raised when a dependency cannot be resolved or instantiated."""

    def __init__(self, target: str, reason: str) -> None:
        super().__init__(
            f"Failed to resolve '{target}': {reason}",
            "DEPENDENCY_RESOLUTION_ERROR",
        )
        self.target = target
        self.reason = reason

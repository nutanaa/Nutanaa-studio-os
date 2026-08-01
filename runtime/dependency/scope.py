from __future__ import annotations

from threading import RLock
from typing import Any


class DependencyScope:
    """Scoped view over a dependency container."""

    def __init__(self, container: "DependencyContainer") -> None:
        self._container = container
        self._lock = RLock()
        self._instances: dict[str, Any] = {}
        self._stack: list[str] = []

    def resolve(self, service_type: type[Any]) -> Any:
        """Resolve a service by type within this scope."""
        return self._container.resolve(service_type, scope=self, _stack=self._stack)

    def resolve_keyed(self, key: str) -> Any:
        """Resolve a service by key within this scope."""
        return self._container.resolve_keyed(key, scope=self, _stack=self._stack)

    def resolve_scoped(
        self,
        provider: "ServiceProvider",
        *,
        stack: list[str] | None = None,
    ) -> Any:
        """Resolve and cache a scoped provider."""
        with self._lock:
            if provider.key not in self._instances:
                self._instances[provider.key] = provider._create(
                    self._container,
                    scope=self,
                    stack=stack,
                )
            return self._instances[provider.key]

    def clear(self) -> None:
        """Clear cached scoped instances."""
        with self._lock:
            self._instances.clear()
            self._stack.clear()

    @property
    def instance_count(self) -> int:
        """Return the number of scoped instances."""
        with self._lock:
            return len(self._instances)


if False:  # pragma: no cover
    from runtime.dependency.container import DependencyContainer
    from runtime.dependency.service_provider import ServiceProvider

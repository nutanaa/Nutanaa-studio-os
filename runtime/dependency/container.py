from __future__ import annotations

from threading import RLock
from typing import Any, Callable, TypeVar

from runtime.dependency.exceptions import ServiceNotRegisteredError
from runtime.dependency.lifetime import ServiceLifetime
from runtime.dependency.scope import DependencyScope
from runtime.dependency.service_provider import ServiceProvider

T = TypeVar("T")


class DependencyContainer:
    """Type-aware dependency injection container."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._providers: dict[str, ServiceProvider] = {}

    def register(
        self,
        service_type: type[T],
        factory: Callable[[], T] | type[T] | None = None,
        *,
        singleton: bool = True,
    ) -> None:
        """Register *service_type* with optional factory."""
        self.register_keyed(
            _type_key(service_type),
            factory or service_type,
            singleton=singleton,
        )

    def register_instance(self, service_type: type[T], instance: T) -> None:
        """Register an already constructed instance."""
        key = _type_key(service_type)
        with self._lock:
            self._providers[key] = ServiceProvider(
                key=key,
                factory=lambda: instance,
                lifetime=ServiceLifetime.SINGLETON,
                instance=instance,
            )

    def register_keyed(
        self,
        key: str,
        factory: Callable[[], Any] | type[Any],
        *,
        singleton: bool = True,
    ) -> None:
        """Register a factory under an explicit key."""
        lifetime = ServiceLifetime.SINGLETON if singleton else ServiceLifetime.TRANSIENT
        with self._lock:
            self._providers[key] = ServiceProvider(
                key=key,
                factory=factory,
                lifetime=lifetime,
            )

    def resolve(
        self,
        service_type: type[T],
        *,
        scope: DependencyScope | None = None,
        _stack: list[str] | None = None,
    ) -> T:
        """Resolve a service by type."""
        return self.resolve_keyed(_type_key(service_type), scope=scope, _stack=_stack)

    def resolve_keyed(
        self,
        key: str,
        *,
        scope: DependencyScope | None = None,
        _stack: list[str] | None = None,
    ) -> Any:
        """Resolve a service by key."""
        provider = self._get_provider(key)
        return provider.resolve(self, scope=scope, stack=_stack)

    def is_registered(self, service_type: type[Any] | str) -> bool:
        """Return whether a service is registered."""
        key = service_type if isinstance(service_type, str) else _type_key(service_type)
        with self._lock:
            return key in self._providers

    def create_scope(self) -> DependencyScope:
        """Create a new scoped resolution context."""
        return DependencyScope(self)

    def clear(self) -> None:
        """Remove all registrations."""
        with self._lock:
            self._providers.clear()

    def registered_types(self) -> tuple[str, ...]:
        """Return all registered keys."""
        with self._lock:
            return tuple(self._providers.keys())

    def _get_provider(self, key: str) -> ServiceProvider:
        with self._lock:
            provider = self._providers.get(key)
        if provider is None:
            raise ServiceNotRegisteredError(key)
        return provider


def _type_key(value: type[Any]) -> str:
    """Derive a stable registry key for a type."""
    return f"{value.__module__}.{value.__qualname__}"

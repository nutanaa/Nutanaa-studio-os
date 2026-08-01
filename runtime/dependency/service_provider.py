from __future__ import annotations

import inspect
from dataclasses import dataclass, field
from threading import RLock
from typing import TYPE_CHECKING, Any, Callable

from runtime.dependency.exceptions import DependencyResolutionError
from runtime.dependency.lifetime import ServiceLifetime

if TYPE_CHECKING:  # pragma: no cover
    from runtime.dependency.container import DependencyContainer
    from runtime.dependency.scope import DependencyScope


@dataclass(slots=True)
class ServiceProvider:
    """Descriptor for a single registered service."""

    key: str
    factory: Callable[[], Any] | type[Any]
    lifetime: ServiceLifetime
    instance: Any = None
    _lock: RLock = field(default_factory=RLock, init=False, repr=False, compare=False)

    def resolve(
        self,
        container: "DependencyContainer",
        scope: "DependencyScope | None" = None,
        stack: list[str] | None = None,
    ) -> Any:
        """Resolve the service according to its lifetime."""
        if self.lifetime is ServiceLifetime.SINGLETON:
            with self._lock:
                if self.instance is None:
                    self.instance = self._create(container, scope, stack)
                return self.instance

        if self.lifetime is ServiceLifetime.SCOPED and scope is not None:
            return scope.resolve_scoped(self, stack=stack)

        return self._create(container, scope, stack)

    def _create(
        self,
        container: "DependencyContainer",
        scope: "DependencyScope | None" = None,
        stack: list[str] | None = None,
    ) -> Any:
        """Instantiate the service."""
        factory = self.factory
        if inspect.isclass(factory):
            from runtime.dependency.resolver import DependencyResolver

            resolver = DependencyResolver(container, scope=scope, stack=stack)
            return resolver.create(factory)

        try:
            return factory()
        except Exception as exc:  # pragma: no cover - defensive
            raise DependencyResolutionError(self.key, str(exc)) from exc

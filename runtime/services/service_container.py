"""Thread-safe service container with singleton and transient support."""

from __future__ import annotations

import logging
from threading import RLock
from typing import Any, Callable, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")

_SENTINEL = object()


class ServiceContainer:
    """Lightweight IoC container supporting singleton and transient lifetimes.

    Usage::

        container = ServiceContainer()
        container.register_singleton("db", lambda: Database())
        db = container.resolve("db")

    Attributes:
        _lock: Reentrant lock for thread-safe registration and resolution.
    """

    def __init__(self) -> None:
        self._lock = RLock()
        self._factories: dict[str, tuple[Callable[[], Any], bool]] = {}
        self._singletons: dict[str, Any] = {}

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register_singleton(self, key: str, factory: Callable[[], Any]) -> None:
        """Register a singleton-lifetime factory.

        The factory is called at most once; subsequent resolutions return the
        cached instance.

        Args:
            key: Unique service identifier.
            factory: Zero-argument callable that creates the service instance.
        """
        with self._lock:
            self._factories[key] = (factory, True)
            self._singletons.pop(key, None)
        logger.debug("Registered singleton: '%s'", key)

    def register_transient(self, key: str, factory: Callable[[], Any]) -> None:
        """Register a transient-lifetime factory.

        The factory is called on every resolution.

        Args:
            key: Unique service identifier.
            factory: Zero-argument callable that creates the service instance.
        """
        with self._lock:
            self._factories[key] = (factory, False)
        logger.debug("Registered transient: '%s'", key)

    def register_instance(self, key: str, instance: Any) -> None:
        """Register a pre-built instance as a singleton.

        Args:
            key: Unique service identifier.
            instance: The service instance to store.
        """
        with self._lock:
            self._factories[key] = (lambda: instance, True)
            self._singletons[key] = instance
        logger.debug("Registered instance: '%s'", key)

    # ------------------------------------------------------------------
    # Resolution
    # ------------------------------------------------------------------

    def resolve(self, key: str) -> Any:
        """Resolve and return a service by key.

        Args:
            key: Service identifier.

        Returns:
            The service instance.

        Raises:
            KeyError: If no service is registered under *key*.
        """
        with self._lock:
            if key not in self._factories:
                raise KeyError(f"Service not registered: '{key}'")
            factory, is_singleton = self._factories[key]
            if is_singleton:
                if key not in self._singletons:
                    self._singletons[key] = factory()
                    logger.debug("Created singleton instance: '%s'", key)
                return self._singletons[key]
            instance = factory()
            logger.debug("Created transient instance: '%s'", key)
            return instance

    def is_registered(self, key: str) -> bool:
        """Return whether a service key is registered."""
        with self._lock:
            return key in self._factories

    def registered_keys(self) -> list[str]:
        """Return all registered service keys."""
        with self._lock:
            return list(self._factories.keys())

from __future__ import annotations

import logging
from threading import RLock
from typing import Any

logger = logging.getLogger(__name__)


class ServiceRegistry:
    """Thread-safe registry for named runtime services."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._services: dict[str, Any] = {}

    def register(self, name: str, service: Any) -> None:
        """Register a service by name."""
        with self._lock:
            self._services[name] = service
        logger.debug("Registered service: '%s'", name)

    def unregister(self, name: str) -> None:
        """Remove a service by name."""
        with self._lock:
            self._services.pop(name, None)
        logger.debug("Unregistered service: '%s'", name)

    def get(self, name: str) -> Any:
        """Return a registered service by name."""
        with self._lock:
            return self._services[name]

    def exists(self, name: str) -> bool:
        """Return whether a service exists."""
        with self._lock:
            return name in self._services

    def list_services(self) -> list[str]:
        """Return registered service names."""
        with self._lock:
            return list(self._services.keys())

    def clear(self) -> None:
        """Clear all registered services."""
        with self._lock:
            self._services.clear()
        logger.debug("Cleared service registry")

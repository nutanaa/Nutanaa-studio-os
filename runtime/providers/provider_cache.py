from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock
from time import monotonic
from typing import Any

_SENTINEL = object()


@dataclass(slots=True)
class CacheEntry:
    """Single cache entry with optional expiry."""

    value: Any
    expires_at: float | None = None
    created_at: float = field(default_factory=monotonic)

    @property
    def expired(self) -> bool:
        """Return whether the entry has expired."""
        return self.expires_at is not None and monotonic() >= self.expires_at


class ProviderCache:
    """Thread-safe in-memory cache for provider responses."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._entries: dict[str, CacheEntry] = {}

    def put(self, key: str, value: Any, ttl_seconds: float | None = None) -> None:
        """Store a cache entry."""
        expires_at = None if ttl_seconds is None else monotonic() + ttl_seconds
        with self._lock:
            self._entries[key] = CacheEntry(value=value, expires_at=expires_at)

    def get(self, key: str, default: Any = None) -> Any:
        """Return a cached value if present and valid."""
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return default
            if entry.expired:
                self._entries.pop(key, None)
                return default
            return entry.value

    def delete(self, key: str) -> None:
        """Remove a cache entry."""
        with self._lock:
            self._entries.pop(key, None)

    def clear(self) -> None:
        """Clear all cached entries."""
        with self._lock:
            self._entries.clear()

    def keys(self) -> tuple[str, ...]:
        """Return cached keys."""
        with self._lock:
            return tuple(self._entries.keys())

    def __contains__(self, key: str) -> bool:
        return self.get(key, default=_SENTINEL) is not _SENTINEL

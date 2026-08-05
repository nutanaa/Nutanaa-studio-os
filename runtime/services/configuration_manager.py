from __future__ import annotations

from typing import Any

from runtime.config.settings import RuntimeSettings


class ConfigurationManager:
    """Centralised runtime configuration manager."""

    def __init__(self, settings: RuntimeSettings) -> None:
        self._settings = settings
        self._overrides: dict[str, Any] = {}

    def get(self, key: str, default: Any = None) -> Any:
        """Return a configuration value by key."""
        return getattr(self._settings, key, self._overrides.get(key, default))

    def set(self, key: str, value: Any) -> None:
        """Override a configuration value at runtime."""
        self._overrides[key] = value

    def all(self) -> dict[str, Any]:
        """Return a combined configuration snapshot."""
        current = {k: v for k, v in vars(self._settings).items() if not k.startswith("_")}
        current.update(self._overrides)
        return current

    def refresh(self, settings: RuntimeSettings) -> None:
        """Refresh the runtime settings backing store."""
        self._settings = settings

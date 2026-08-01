"""Core config loader re-export for convenient bootstrap access."""

from __future__ import annotations

# Re-export from the canonical config package so bootstrap can import from
# either runtime.core or runtime.config.
from runtime.config.loader import ConfigLoader
from runtime.config.settings import RuntimeSettings

__all__ = ["ConfigLoader", "RuntimeSettings"]

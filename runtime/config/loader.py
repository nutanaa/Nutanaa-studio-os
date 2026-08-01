"""Configuration loader for NUTANAA Studio OS runtime."""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from runtime.config.environment import (
    get_config_path,
    get_default_provider,
    load_dotenv,
)
from runtime.config.settings import RuntimeSettings

logger = logging.getLogger(__name__)


class ConfigLoader:
    """Loads and merges runtime configuration from .env and JSON files.

    Priority (highest → lowest):
    1. Explicit keyword arguments passed to :meth:`load`.
    2. Environment variables.
    3. JSON config file (path from ``NUTANAA_CONFIG_PATH``).
    4. Built-in defaults in :class:`RuntimeSettings`.
    """

    def __init__(self, dotenv_path: str = ".env") -> None:
        self._dotenv_path = dotenv_path

    def load(self, **overrides: str) -> RuntimeSettings:
        """Load and return a merged :class:`RuntimeSettings`."""
        load_dotenv(self._dotenv_path)

        file_data: dict[str, str] = {}
        config_path = get_config_path()
        if config_path:
            file_data = self._load_json(config_path)

        log_level = (
            overrides.get(
                "log_level",
                os.environ.get("NUTANAA_LOG_LEVEL", file_data.get("log_level", "INFO")),
            )
            or "INFO"
        ).upper()

        default_provider = overrides.get(
            "default_provider",
            get_default_provider() or file_data.get("default_provider", ""),
        )

        settings = RuntimeSettings(
            log_level=log_level,
            default_provider=default_provider,
            config_path=overrides.get("config_path", config_path),
            extra={
                k: v
                for k, v in {**file_data, **overrides}.items()
                if k not in {"log_level", "default_provider", "config_path"}
            },
        )
        logger.debug("Configuration loaded: %s", settings)
        return settings

    @staticmethod
    def _load_json(path: str) -> dict[str, str]:
        """Parse a JSON config file, returning an empty dict on failure."""
        try:
            text = Path(path).read_text(encoding="utf-8")
            data = json.loads(text)
            if isinstance(data, dict):
                return {str(k): str(v) for k, v in data.items()}
        except (FileNotFoundError, json.JSONDecodeError, OSError) as exc:
            logger.warning("Could not load config file '%s': %s", path, exc)
        return {}

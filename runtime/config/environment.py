"""Environment variable helpers for NUTANAA Studio OS runtime."""

from __future__ import annotations

import os

from runtime.constants import ENV_CONFIG_PATH, ENV_LOG_LEVEL, ENV_PROVIDER_DEFAULT


def get_log_level() -> str:
    """Return the log level from environment, defaulting to ``INFO``."""
    return os.environ.get(ENV_LOG_LEVEL, "INFO").upper()


def get_default_provider() -> str:
    """Return the default provider name from environment."""
    return os.environ.get(ENV_PROVIDER_DEFAULT, "")


def get_config_path() -> str:
    """Return the config file path from environment."""
    return os.environ.get(ENV_CONFIG_PATH, "")


def load_dotenv(path: str = ".env") -> None:
    """Parse a .env file and inject values into ``os.environ``.

    Only keys not already set in the environment are written (non-overriding).
    Lines starting with ``#`` and blank lines are ignored.

    Args:
        path: Path to the ``.env`` file.
    """
    try:
        with open(path) as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                os.environ.setdefault(key, value)
    except FileNotFoundError:
        pass

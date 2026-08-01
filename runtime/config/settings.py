"""Runtime settings dataclass for NUTANAA Studio OS."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class RuntimeSettings:
    """Holds validated runtime configuration values.

    Attributes:
        log_level: Logging level string, e.g. ``"INFO"``.
        default_provider: Name of the default AI provider.
        config_path: Optional path to an external config file.
        extra: Arbitrary additional settings.
    """

    log_level: str = "INFO"
    default_provider: str = ""
    config_path: str = ""
    extra: dict[str, str] = field(default_factory=dict)

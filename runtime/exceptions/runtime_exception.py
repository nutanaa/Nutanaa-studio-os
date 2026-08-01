"""General runtime exception."""

from __future__ import annotations

from runtime.exceptions.base_exception import NutanaaBaseException


class RuntimeException(NutanaaBaseException):
    """Raised for general runtime lifecycle failures."""

    def __init__(self, message: str, code: str = "RUNTIME_ERROR") -> None:
        super().__init__(message, code)

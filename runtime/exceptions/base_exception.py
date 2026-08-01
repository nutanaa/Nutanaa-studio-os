from __future__ import annotations


class NutanaaBaseError(Exception):
    """Root exception for all NUTANAA runtime errors.

    All domain-specific exceptions inherit from this class so callers can catch
    a single broad type when needed.

    Attributes:
        message: Human-readable error description.
        code: Optional machine-readable error code string.
    """

    def __init__(self, message: str, code: str = "NUTANAA_ERROR") -> None:
        super().__init__(message)
        self.message = message
        self.code = code

    def __str__(self) -> str:
        return f"[{self.code}] {self.message}"


# Backward-compatible alias
NutanaaBaseException = NutanaaBaseError

__all__ = ["NutanaaBaseError", "NutanaaBaseException"]

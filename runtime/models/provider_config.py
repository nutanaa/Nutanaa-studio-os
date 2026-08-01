from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


class ProviderConfig(BaseModel):
    """Configuration model for providers.

    This model captures the minimal provider settings required to describe a
    runtime provider configuration and validate it before use.
    """

    provider_name: str = Field(default="", min_length=1)
    provider_type: str = Field(default="", min_length=1)
    base_url: str | None = None
    api_key: str | None = None
    timeout: int = Field(default=30, ge=1, le=600)
    max_tokens: int = Field(default=2048, ge=1, le=100000)
    temperature: float = Field(default=0.0, ge=0.0, le=2.0)
    enabled: bool = True
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("provider_name", "provider_type")
    @classmethod
    def validate_non_empty(cls, value: str) -> str:
        """Ensure required string fields are not blank."""
        if not value.strip():
            raise ValueError("value must not be blank")
        return value

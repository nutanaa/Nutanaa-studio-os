from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


class AgentConfig(BaseModel):
    """Configuration model for agents.

    This model captures the structure of agent settings and validates them
    before they are used in runtime execution flows.
    """

    agent_name: str = Field(default="", min_length=1)
    description: str = Field(default="")
    provider: str = Field(default="", min_length=1)
    model: str = Field(default="", min_length=1)
    system_prompt: str = Field(default="")
    tools: list[str] = Field(default_factory=list)
    memory: bool = False
    max_iterations: int = Field(default=5, ge=1, le=100)
    timeout: int = Field(default=30, ge=1, le=600)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("agent_name", "provider", "model")
    @classmethod
    def validate_non_empty(cls, value: str) -> str:
        """Ensure required string fields are not blank."""
        if not value.strip():
            raise ValueError("value must not be blank")
        return value

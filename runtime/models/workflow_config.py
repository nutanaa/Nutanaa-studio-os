from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


class WorkflowConfig(BaseModel):
    """Configuration model for workflows.

    This model captures workflow execution settings and validates them before
    the workflow is executed.
    """

    workflow_name: str = Field(default="", min_length=1)
    steps: list[str] = Field(default_factory=list)
    retry_policy: dict[str, Any] = Field(default_factory=dict)
    timeout: int = Field(default=60, ge=1, le=3600)
    parallel_execution: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("workflow_name")
    @classmethod
    def validate_non_empty(cls, value: str) -> str:
        """Ensure workflow name is not blank."""
        if not value.strip():
            raise ValueError("value must not be blank")
        return value

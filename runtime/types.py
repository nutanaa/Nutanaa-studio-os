"""Shared type aliases for the NUTANAA Studio OS runtime."""

from __future__ import annotations

from typing import Any

# Generic key-value metadata bag
Metadata = dict[str, Any]

# Plugin/Agent/Provider name identifiers
IdentifierStr = str

# Workflow step result payload
StepResult = dict[str, Any]

# Serialised state blob used by save_state / load_state
StateBlob = dict[str, Any]

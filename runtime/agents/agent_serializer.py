from __future__ import annotations

from typing import Any

from runtime.agents.agent_result import AgentResult
from runtime.agents.agent_state import AgentState


class AgentSerializer:
    """Serialises agent state and results."""

    def state_to_dict(self, state: AgentState) -> dict[str, Any]:
        return {
            "agent_name": state.agent_name,
            "status": state.status.value,
            "current_task": state.current_task,
            "last_input": state.last_input,
            "last_output": state.last_output,
            "started_at": state.started_at.isoformat() if state.started_at else None,
            "updated_at": state.updated_at.isoformat(),
            "ended_at": state.ended_at.isoformat() if state.ended_at else None,
            "errors": list(state.errors),
            "metadata": dict(state.metadata),
        }

    def result_to_dict(self, result: AgentResult) -> dict[str, Any]:
        return {
            "agent_name": result.agent_name,
            "status": result.status.value,
            "output": result.output,
            "error": result.error,
            "started_at": result.started_at.isoformat(),
            "ended_at": result.ended_at.isoformat() if result.ended_at else None,
        }

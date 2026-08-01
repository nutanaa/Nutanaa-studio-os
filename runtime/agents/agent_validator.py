from __future__ import annotations

from runtime.agents.agent_exceptions import AgentValidationError
from runtime.contracts.i_agent import IAgent


class AgentValidator:
    """Validates agents against the runtime contract."""

    REQUIRED_METHODS = (
        "initialize",
        "execute",
        "validate",
        "cancel",
        "pause",
        "resume",
        "status",
        "shutdown",
    )

    def validate(self, agent: IAgent) -> None:
        for method in self.REQUIRED_METHODS:
            if not hasattr(agent, method):
                raise AgentValidationError(f"Agent missing method: {method}")

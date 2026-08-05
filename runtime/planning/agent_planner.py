from __future__ import annotations

from typing import TYPE_CHECKING

from runtime.planning.models import AgentType, ComplexityLevel, IntentCategory

if TYPE_CHECKING:  # pragma: no cover
    from runtime.tasks.execution_request import ExecutionRequest


class AgentPlanner:
    """Recommend agent roles based on intent and plan complexity."""

    def plan_agents(
        self,
        intent: IntentCategory,
        complexity: ComplexityLevel,
        request: ExecutionRequest | None = None,
    ) -> list[str]:
        mapping: dict[IntentCategory, list[AgentType]] = {
            IntentCategory.CHAT: [AgentType.CHAT_AGENT],
            IntentCategory.CODING: [AgentType.CODING_AGENT],
            IntentCategory.DEBUGGING: [AgentType.CODING_AGENT],
            IntentCategory.REFACTORING: [AgentType.CODING_AGENT],
            IntentCategory.ARCHITECTURE: [AgentType.PLANNING_AGENT],
            IntentCategory.RESEARCH: [AgentType.RESEARCH_AGENT],
            IntentCategory.PLANNING: [AgentType.PLANNING_AGENT],
            IntentCategory.DOCUMENTATION: [AgentType.DOCUMENTATION_AGENT],
            IntentCategory.TESTING: [AgentType.TESTING_AGENT],
            IntentCategory.WORKFLOW: [AgentType.WORKFLOW_AGENT],
            IntentCategory.AUTOMATION: [AgentType.WORKFLOW_AGENT],
            IntentCategory.PROJECT_ANALYSIS: [AgentType.MEMORY_AGENT, AgentType.PLANNING_AGENT],
            IntentCategory.KNOWLEDGE_QUERY: [AgentType.KNOWLEDGE_AGENT],
            IntentCategory.IMAGE_GENERATION: [AgentType.PLANNING_AGENT],
            IntentCategory.VIDEO_GENERATION: [AgentType.PLANNING_AGENT],
            IntentCategory.AUDIO: [AgentType.PLANNING_AGENT],
            IntentCategory.MIXED_MODAL: [AgentType.PLANNING_AGENT],
        }

        agents = mapping.get(intent, [AgentType.CHAT_AGENT])
        if complexity == ComplexityLevel.MULTI_AGENT:
            agent_names = {agent.value for agent in agents}
            agent_names.add(AgentType.WORKFLOW_AGENT.value)
            agent_names.add(AgentType.PLANNING_AGENT.value)
            return sorted(agent_names)

        if request is not None and request.agent_name:
            agents = [AgentType(request.agent_name) if request.agent_name in AgentType.__members__ else AgentType.CODING_AGENT]

        return [agent.value for agent in agents]

from __future__ import annotations

from runtime.planning.agent_planner import AgentPlanner
from runtime.planning.complexity_analyzer import ComplexityAnalyzer
from runtime.planning.intent_analyzer import IntentAnalyzer
from runtime.planning.models import (
    ExecutionPlan,
    IntentCategory,
    PlanningEventType,
)
from runtime.planning.plan_optimizer import PlanOptimizer
from runtime.planning.provider_planner import ProviderPlanner
from typing import TYPE_CHECKING, Any

from runtime.planning.task_decomposer import TaskDecomposer
from runtime.planning.tool_planner import ToolPlanner
from runtime.utils.logger import get_logger

if TYPE_CHECKING:  # pragma: no cover
    from runtime.tasks.execution_context import ExecutionContext
    from runtime.tasks.execution_request import ExecutionRequest

logger = get_logger(__name__)


class PlanningEngine:
    """Reasoning layer that converts requests into executable plans."""

    def __init__(
        self,
        intent_analyzer: IntentAnalyzer | None = None,
        complexity_analyzer: ComplexityAnalyzer | None = None,
        task_decomposer: TaskDecomposer | None = None,
        tool_planner: ToolPlanner | None = None,
        agent_planner: AgentPlanner | None = None,
        provider_planner: ProviderPlanner | None = None,
        plan_optimizer: PlanOptimizer | None = None,
    ) -> None:
        self.intent_analyzer = intent_analyzer or IntentAnalyzer()
        self.complexity_analyzer = complexity_analyzer or ComplexityAnalyzer()
        self.task_decomposer = task_decomposer or TaskDecomposer()
        self.tool_planner = tool_planner or ToolPlanner()
        self.agent_planner = agent_planner or AgentPlanner()
        self.provider_planner = provider_planner or ProviderPlanner()
        self.plan_optimizer = plan_optimizer or PlanOptimizer()

    async def create_plan(
        self,
        request: ExecutionRequest,
        context: ExecutionContext,
    ) -> ExecutionPlan:
        if context.planner is not None:
            request = await context.planner.plan(request, context)

        intent = self.intent_analyzer.analyze(request)
        await self._emit_event(
            PlanningEventType.INTENT_DETECTED,
            request,
            context,
            {
                "intent": intent.value,
                "request_id": request.request_id,
            },
        )

        complexity = self.complexity_analyzer.analyze(request, intent)
        subtasks = self.task_decomposer.decompose(request, intent, complexity)
        for subtask in subtasks:
            await self._emit_event(
                PlanningEventType.TASK_SPLIT,
                request,
                context,
                {
                    "subtask_id": subtask.subtask_id,
                    "title": subtask.title,
                    "complexity": subtask.complexity.value,
                },
            )

        selected_agents = self.agent_planner.plan_agents(request=request, intent=intent, complexity=complexity)
        await self._emit_event(
            PlanningEventType.AGENT_ASSIGNED,
            request,
            context,
            {"selected_agents": selected_agents},
        )

        selected_providers = self.provider_planner.plan_providers(
            request=request,
            intent=intent,
            provider_manager=context.provider_manager,
        )
        await self._emit_event(
            PlanningEventType.PROVIDER_ASSIGNED,
            request,
            context,
            {"selected_providers": selected_providers},
        )

        required_tools = self.tool_planner.plan_tools(
            intent=intent,
            complexity=complexity,
            prompt=str(request.prompt or request.input_data or ""),
        )

        plan = ExecutionPlan(
            goal=str(request.prompt or request.input_data or ""),
            request_id=request.request_id,
            task_id=request.task_id,
            task_type=request.task_type,
            source_text=str(request.prompt or request.input_data or ""),
            intent=intent,
            complexity=complexity,
            subtasks=subtasks,
            execution_order=[subtask.subtask_id for subtask in subtasks],
            selected_agents=selected_agents,
            selected_providers=selected_providers,
            selected_models=[request.model] if request.model else [],
            required_workspace_context=self._infer_workspace_context(intent),
            required_knowledge=self._infer_knowledge(intent),
            required_tools=required_tools,
            metadata={
                "provider_capability": str(request.capability) if request.capability else None,
            },
        )

        optimized_plan = self.plan_optimizer.optimize(plan)
        await self._emit_event(
            PlanningEventType.EXECUTION_PLAN_READY,
            request,
            context,
            {
                "plan_id": optimized_plan.plan_id,
                "goal": optimized_plan.goal,
                "intent": optimized_plan.intent.value,
                "complexity": optimized_plan.complexity.value,
            },
        )
        return optimized_plan

    def _infer_workspace_context(self, intent: IntentCategory) -> list[str]:
        if intent in (
            IntentCategory.CODING,
            IntentCategory.DEBUGGING,
            IntentCategory.REFACTORING,
            IntentCategory.TESTING,
            IntentCategory.PROJECT_ANALYSIS,
            IntentCategory.WORKFLOW,
            IntentCategory.AUTOMATION,
        ):
            return ["source_code", "project_files", "dependencies"]
        return ["knowledge_base"]

    def _infer_knowledge(self, intent: IntentCategory) -> list[str]:
        if intent in (
            IntentCategory.ARCHITECTURE,
            IntentCategory.PLANNING,
            IntentCategory.PROJECT_ANALYSIS,
            IntentCategory.RESEARCH,
        ):
            return ["system_design", "domain_knowledge"]
        if intent == IntentCategory.TESTING:
            return ["test_frameworks", "quality_metrics"]
        return ["general_knowledge"]

    async def _emit_event(
        self,
        event_type: PlanningEventType,
        request: ExecutionRequest,
        context: ExecutionContext,
        payload: dict[str, Any],
    ) -> None:
        try:
            await context.event_bus.emit(
                event_type.value,
                "PlanningEngine",
                payload,
                subject_id=request.request_id,
            )
        except Exception as exc:  # pragma: no cover - defensive event handling
            logger.debug("Failed to emit planning event %s: %s", event_type, exc)

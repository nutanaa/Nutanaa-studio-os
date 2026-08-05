from __future__ import annotations

from runtime.planning.models import ExecutionPlan, ExecutionSubtask, ToolRecommendation


class PlanOptimizer:
    """Optimize execution plans by deduping work and normalizing recommendations."""

    def optimize(self, plan: ExecutionPlan) -> ExecutionPlan:
        plan.subtasks = self._dedupe_subtasks(plan.subtasks)
        plan.execution_order = [subtask.subtask_id for subtask in plan.subtasks]
        plan.selected_agents = self._dedupe_strings(plan.selected_agents)
        plan.selected_providers = self._dedupe_strings(plan.selected_providers)
        plan.selected_models = self._dedupe_strings(plan.selected_models)
        plan.required_workspace_context = self._dedupe_strings(plan.required_workspace_context)
        plan.required_knowledge = self._dedupe_strings(plan.required_knowledge)
        plan.required_tools = self._dedupe_tools(plan.required_tools)
        plan.estimated_duration_seconds = sum(subtask.estimated_duration_seconds for subtask in plan.subtasks)
        return plan

    def _dedupe_subtasks(self, subtasks: list[ExecutionSubtask]) -> list[ExecutionSubtask]:
        unique: dict[tuple[str, str], ExecutionSubtask] = {}
        for subtask in subtasks:
            key = (subtask.title.strip().lower(), subtask.description.strip().lower())
            if key not in unique:
                unique[key] = subtask
                continue
            existing = unique[key]
            existing.estimated_duration_seconds = max(
                existing.estimated_duration_seconds,
                subtask.estimated_duration_seconds,
            )
            existing.optional = existing.optional and subtask.optional
            existing.retryable = existing.retryable or subtask.retryable
        return list(unique.values())

    def _dedupe_strings(self, values: list[str]) -> list[str]:
        return list(dict.fromkeys([value for value in values if value]))

    def _dedupe_tools(self, tools: list[ToolRecommendation]) -> list[ToolRecommendation]:
        unique: dict[str, ToolRecommendation] = {}
        for tool in tools:
            if tool.tool not in unique:
                unique[tool.tool] = tool
        return list(unique.values())

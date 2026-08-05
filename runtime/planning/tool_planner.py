from __future__ import annotations

from runtime.planning.models import (
    IntentCategory,
    ComplexityLevel,
    ToolRecommendation,
    ToolType,
)


class ToolPlanner:
    """Determine which tools a plan requires before execution."""

    def plan_tools(
        self,
        intent: IntentCategory,
        complexity: ComplexityLevel,
        prompt: str,
    ) -> list[ToolRecommendation]:
        tools: list[ToolRecommendation] = []
        prompt_lower = prompt.strip().lower()

        if intent in (
            IntentCategory.CODING,
            IntentCategory.DEBUGGING,
            IntentCategory.REFACTORING,
            IntentCategory.TESTING,
            IntentCategory.PROJECT_ANALYSIS,
            IntentCategory.WORKFLOW,
            IntentCategory.AUTOMATION,
        ):
            tools.append(
                ToolRecommendation(
                    tool=ToolType.WORKSPACE_INDEXING,
                    reason="Code and workflow tasks need workspace context.",
                )
            )
            tools.append(
                ToolRecommendation(
                    tool=ToolType.FILESYSTEM,
                    reason="Access project files and configuration.",
                )
            )
            tools.append(
                ToolRecommendation(
                    tool=ToolType.GIT,
                    reason="Project tasks often need repo state.",
                )
            )
            tools.append(
                ToolRecommendation(
                    tool=ToolType.PYTHON,
                    reason="Runtime or code tasks may execute Python tooling.",
                )
            )

        if intent in (
            IntentCategory.RESEARCH,
            IntentCategory.KNOWLEDGE_QUERY,
            IntentCategory.PLANNING,
            IntentCategory.DOCUMENTATION,
            IntentCategory.PROJECT_ANALYSIS,
        ):
            tools.append(
                ToolRecommendation(
                    tool=ToolType.SEMANTIC_SEARCH,
                    reason="Research and planning tasks benefit from semantic retrieval.",
                )
            )
            tools.append(
                ToolRecommendation(
                    tool=ToolType.MEMORY_RETRIEVAL,
                    reason="Knowledge and project analysis may require memory context.",
                )
            )
            tools.append(
                ToolRecommendation(
                    tool=ToolType.BROWSER,
                    reason="Documentation and research tasks may use external references.",
                )
            )

        if intent == IntentCategory.DEBUGGING:
            tools.append(
                ToolRecommendation(
                    tool=ToolType.TERMINAL,
                    reason="Debugging often needs terminal access for diagnostics.",
                )
            )

        if intent == IntentCategory.IMAGE_GENERATION:
            tools.append(
                ToolRecommendation(
                    tool=ToolType.IMAGE_GENERATION,
                    reason="Image requests require an image generation tool.",
                )
            )

        if intent == IntentCategory.VIDEO_GENERATION:
            tools.append(
                ToolRecommendation(
                    tool=ToolType.VIDEO_GENERATION,
                    reason="Video requests require a video generation tool.",
                )
            )

        if intent == IntentCategory.AUDIO:
            tools.append(
                ToolRecommendation(
                    tool=ToolType.AUDIO,
                    reason="Audio requests require an audio generation tool.",
                )
            )

        if intent == IntentCategory.MIXED_MODAL:
            tools.append(
                ToolRecommendation(
                    tool=ToolType.FUTURE_PLUGIN,
                    reason="Mixed modal requests may need plugin-based capabilities.",
                )
            )

        if complexity == ComplexityLevel.LONG_RUNNING:
            tools.append(
                ToolRecommendation(
                    tool=ToolType.FUTURE_PLUGIN,
                    reason="Long-running tasks may require external orchestration.",
                )
            )

        unique: dict[ToolType, ToolRecommendation] = {}
        for recommendation in tools:
            if recommendation.tool not in unique:
                unique[recommendation.tool] = recommendation
        return list(unique.values())

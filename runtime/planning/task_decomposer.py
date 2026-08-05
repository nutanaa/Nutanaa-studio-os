from __future__ import annotations

from typing import TYPE_CHECKING

from runtime.planning.models import (
    ComplexityLevel,
    ExecutionSubtask,
    IntentCategory,
    ToolType,
)

if TYPE_CHECKING:  # pragma: no cover
    from runtime.tasks.execution_request import ExecutionRequest


class TaskDecomposer:
    """Break a request into ordered subtasks for a plan."""

    def decompose(
        self,
        request: ExecutionRequest,
        intent: IntentCategory,
        complexity: ComplexityLevel,
    ) -> list[ExecutionSubtask]:
        prompt = str(request.prompt or request.input_data or "").strip()
        if not prompt:
            return [self._create_subtask("Clarify intent", "Empty request received.", intent, complexity)]

        if complexity in (ComplexityLevel.SIMPLE, ComplexityLevel.MEDIUM):
            return [self._create_subtask("Execute request", prompt, intent, complexity)]

        if intent == IntentCategory.ARCHITECTURE:
            return [
                self._create_subtask(
                    "Review requirements",
                    "Understand system goals, constraints, and use cases.",
                    intent,
                    complexity,
                ),
                self._create_subtask(
                    "Design solution",
                    "Define architecture, components, and interactions.",
                    intent,
                    complexity,
                ),
                self._create_subtask(
                    "Document architecture",
                    "Summarize the architecture, design decisions, and next steps.",
                    intent,
                    complexity,
                ),
            ]

        if intent == IntentCategory.PROJECT_ANALYSIS:
            return [
                self._create_subtask(
                    "Collect project data",
                    "Index workspace files, dependency graphs, and current project state.",
                    intent,
                    complexity,
                ),
                self._create_subtask(
                    "Assess project health",
                    "Analyze code quality, architecture risks, and missing documentation.",
                    intent,
                    complexity,
                ),
                self._create_subtask(
                    "Recommend improvements",
                    "Propose actionable next steps and prioritized changes.",
                    intent,
                    complexity,
                ),
            ]

        candidate_clauses = self._split_into_clauses(prompt)
        if len(candidate_clauses) > 1:
            subtasks = []
            for clause in candidate_clauses:
                subtasks.append(
                    self._create_subtask(
                        clause.capitalize(),
                        clause,
                        intent,
                        complexity,
                    )
                )
            self._assign_dependencies(subtasks, prompt)
            return subtasks

        return [self._create_subtask("Execute request", prompt, intent, complexity)]

    def _split_into_clauses(self, prompt: str) -> list[str]:
        separators = [";", " then ", " and ", "\n"]
        clauses = [prompt]
        for separator in separators:
            if separator in prompt:
                clauses = [clause.strip() for clause in prompt.split(separator) if clause.strip()]
                break
        return clauses

    def _assign_dependencies(self, subtasks: list[ExecutionSubtask], prompt: str) -> None:
        if "in parallel" in prompt or "simultaneously" in prompt:
            for subtask in subtasks:
                subtask.parallelizable = True
            return

        for index, subtask in enumerate(subtasks):
            if index > 0:
                subtask.dependencies = [subtasks[index - 1].subtask_id]

    def _create_subtask(
        self,
        title: str,
        description: str,
        intent: IntentCategory,
        complexity: ComplexityLevel,
    ) -> ExecutionSubtask:
        return ExecutionSubtask(
            title=title,
            description=description,
            intent_category=intent,
            complexity=complexity,
            estimated_duration_seconds=self._estimate_duration(complexity),
            required_tools=self._default_tools(intent),
        )

    def _estimate_duration(self, complexity: ComplexityLevel) -> float:
        return {
            ComplexityLevel.SIMPLE: 60.0,
            ComplexityLevel.MEDIUM: 180.0,
            ComplexityLevel.COMPLEX: 600.0,
            ComplexityLevel.MULTI_AGENT: 900.0,
            ComplexityLevel.LONG_RUNNING: 3600.0,
        }[complexity]

    def _default_tools(self, intent: IntentCategory) -> list[ToolType]:
        if intent in (
            IntentCategory.CODING,
            IntentCategory.DEBUGGING,
            IntentCategory.REFACTORING,
            IntentCategory.TESTING,
            IntentCategory.PROJECT_ANALYSIS,
            IntentCategory.WORKFLOW,
            IntentCategory.AUTOMATION,
        ):
            return [ToolType.WORKSPACE_INDEXING, ToolType.FILESYSTEM]
        if intent in (
            IntentCategory.RESEARCH,
            IntentCategory.KNOWLEDGE_QUERY,
            IntentCategory.PLANNING,
            IntentCategory.DOCUMENTATION,
        ):
            return [ToolType.SEMANTIC_SEARCH, ToolType.BROWSER]
        if intent == IntentCategory.IMAGE_GENERATION:
            return [ToolType.IMAGE_GENERATION]
        if intent == IntentCategory.VIDEO_GENERATION:
            return [ToolType.VIDEO_GENERATION]
        if intent == IntentCategory.AUDIO:
            return [ToolType.AUDIO]
        return [ToolType.WORKSPACE_INDEXING]

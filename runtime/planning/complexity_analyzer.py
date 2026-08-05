from __future__ import annotations

from typing import TYPE_CHECKING

from runtime.planning.models import ComplexityLevel, IntentCategory

if TYPE_CHECKING:  # pragma: no cover
    from runtime.tasks.execution_request import ExecutionRequest


class ComplexityAnalyzer:
    """Estimate task complexity from the request and detected intent."""

    def analyze(
        self,
        request: ExecutionRequest,
        intent: IntentCategory,
    ) -> ComplexityLevel:
        prompt = str(request.prompt or request.input_data or "").strip().lower()
        if not prompt:
            return ComplexityLevel.SIMPLE

        if intent == IntentCategory.MIXED_MODAL:
            return ComplexityLevel.MULTI_AGENT

        if "long running" in prompt or "continuous" in prompt or "ongoing" in prompt:
            return ComplexityLevel.LONG_RUNNING

        if intent in (
            IntentCategory.ARCHITECTURE,
            IntentCategory.PROJECT_ANALYSIS,
            IntentCategory.WORKFLOW,
            IntentCategory.AUTOMATION,
        ):
            return ComplexityLevel.COMPLEX

        if "multiple agents" in prompt or "orchestrate" in prompt or "coordinate" in prompt:
            return ComplexityLevel.MULTI_AGENT

        if any(token in prompt for token in ("and", ";", "then", "after")) and prompt.count(" ") > 30:
            return ComplexityLevel.COMPLEX

        if len(prompt) > 220 or prompt.count(" ") > 40:
            return ComplexityLevel.MEDIUM

        return ComplexityLevel.SIMPLE

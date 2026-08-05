from __future__ import annotations

from typing import TYPE_CHECKING

from runtime.planning.models import IntentCategory

if TYPE_CHECKING:  # pragma: no cover
    from runtime.tasks.execution_request import ExecutionRequest


class IntentAnalyzer:
    """Detect the high-level intent category for a task request."""

    _category_rules: dict[IntentCategory, tuple[str, ...]] = {
        IntentCategory.IMAGE_GENERATION: (
            "generate image",
            "create image",
            "image of",
            "drawing",
            "illustration",
        ),
        IntentCategory.VIDEO_GENERATION: (
            "generate video",
            "create video",
            "video of",
            "render video",
            "animation",
        ),
        IntentCategory.AUDIO: (
            "audio",
            "sound",
            "voice",
            "speech",
            "music",
            "podcast",
        ),
        IntentCategory.MIXED_MODAL: (
            "multimodal",
            "mixed modal",
            "image and audio",
            "video and audio",
            "image and text",
            "audio and video",
        ),
        IntentCategory.DEBUGGING: (
            "debug",
            "fix bug",
            "stack trace",
            "error",
            "issue",
            "crash",
        ),
        IntentCategory.REFACTORING: (
            "refactor",
            "clean up",
            "cleanup",
            "simplify code",
            "optimize code",
        ),
        IntentCategory.ARCHITECTURE: (
            "architecture",
            "design",
            "system",
            "components",
            "scalable",
            "infrastructure",
        ),
        IntentCategory.TESTING: (
            "unit test",
            "integration test",
            "test",
            "qa",
            "validate",
            "verify",
        ),
        IntentCategory.DOCUMENTATION: (
            "document",
            "docs",
            "readme",
            "documentation",
            "guide",
            "explain",
        ),
        IntentCategory.RESEARCH: (
            "research",
            "investigate",
            "find out",
            "survey",
            "benchmark",
        ),
        IntentCategory.PLANNING: (
            "plan",
            "roadmap",
            "strategy",
            "schedule",
            "timeline",
            "milestone",
        ),
        IntentCategory.WORKFLOW: (
            "workflow",
            "pipeline",
            "process",
            "orchestrate",
            "automate",
        ),
        IntentCategory.AUTOMATION: (
            "automate",
            "automation",
            "script",
            "scheduler",
            "bot",
        ),
        IntentCategory.PROJECT_ANALYSIS: (
            "project analysis",
            "analyze project",
            "audit",
            "review project",
            "project review",
        ),
        IntentCategory.KNOWLEDGE_QUERY: (
            "what is",
            "how does",
            "why",
            "explain",
            "define",
            "tell me",
            "what are",
        ),
        IntentCategory.CODING: (
            "write code",
            "implement",
            "build",
            "function",
            "class",
            "script",
            "program",
            "library",
        ),
        IntentCategory.CHAT: (
            "chat",
            "conversation",
            "ask",
            "talk",
            "discuss",
        ),
    }

    def analyze(self, request: ExecutionRequest) -> IntentCategory:
        prompt = str(request.prompt or request.input_data or "").strip().lower()
        if not prompt:
            return IntentCategory.CHAT

        for category, keywords in self._category_rules.items():
            if any(keyword in prompt for keyword in keywords):
                return category

        if "image" in prompt and "generate" in prompt:
            return IntentCategory.IMAGE_GENERATION
        if "video" in prompt and "generate" in prompt:
            return IntentCategory.VIDEO_GENERATION
        if "audio" in prompt or "speech" in prompt:
            return IntentCategory.AUDIO

        if "debug" in prompt or "fix" in prompt:
            return IntentCategory.DEBUGGING

        return IntentCategory.CHAT

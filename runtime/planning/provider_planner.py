from __future__ import annotations

from typing import TYPE_CHECKING

from runtime.planning.models import IntentCategory
from runtime.providers.provider_capability import ProviderCapability
from runtime.providers.provider_manager import ProviderManager

if TYPE_CHECKING:  # pragma: no cover
    from runtime.tasks.execution_request import ExecutionRequest


class ProviderPlanner:
    """Recommend provider targets based on request capability and intent."""

    def plan_providers(
        self,
        request: ExecutionRequest,
        intent: IntentCategory,
        provider_manager: ProviderManager,
    ) -> list[str]:
        capability = request.capability
        if capability is None:
            capability = self.infer_capability(intent)
            request.capability = capability

        if capability is not None:
            records = provider_manager.find_by_capability(capability)
            if records:
                return [record.name for record in records]

        if provider_manager.default_provider:
            return [provider_manager.default_provider]

        return []

    def infer_capability(self, intent: IntentCategory) -> ProviderCapability | None:
        mapping: dict[IntentCategory, ProviderCapability] = {
            IntentCategory.IMAGE_GENERATION: ProviderCapability.IMAGE,
            IntentCategory.VIDEO_GENERATION: ProviderCapability.VIDEO,
            IntentCategory.AUDIO: ProviderCapability.AUDIO,
            IntentCategory.MIXED_MODAL: ProviderCapability.REASONING,
            IntentCategory.DEBUGGING: ProviderCapability.REASONING,
            IntentCategory.REFACTORING: ProviderCapability.REASONING,
            IntentCategory.CODING: ProviderCapability.REASONING,
            IntentCategory.TESTING: ProviderCapability.REASONING,
            IntentCategory.ARCHITECTURE: ProviderCapability.REASONING,
            IntentCategory.RESEARCH: ProviderCapability.TEXT,
            IntentCategory.PLANNING: ProviderCapability.TEXT,
            IntentCategory.DOCUMENTATION: ProviderCapability.TEXT,
            IntentCategory.WORKFLOW: ProviderCapability.TEXT,
            IntentCategory.AUTOMATION: ProviderCapability.TEXT,
            IntentCategory.PROJECT_ANALYSIS: ProviderCapability.TEXT,
            IntentCategory.KNOWLEDGE_QUERY: ProviderCapability.TEXT,
            IntentCategory.CHAT: ProviderCapability.TEXT,
        }
        return mapping.get(intent)

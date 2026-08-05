from __future__ import annotations

from typing import TYPE_CHECKING

from runtime.providers.provider_manager import ProviderManager, ProviderSelection
from runtime.tasks.execution_request import ExecutionRequest
from runtime.tasks.task_exceptions import TaskExecutionError

if TYPE_CHECKING:  # pragma: no cover
    from runtime.tasks.execution_context import ExecutionContext


class AgentSelector:
    """Default agent selection strategy."""

    async def select(
        self,
        request: ExecutionRequest,
        context: "ExecutionContext",
    ) -> str | None:
        if request.agent_name:
            return request.agent_name
        return None


class ProviderSelector:
    """Default provider selection strategy."""

    def __init__(self, provider_manager: ProviderManager) -> None:
        self._provider_manager = provider_manager

    async def select(
        self,
        request: ExecutionRequest,
        context: "ExecutionContext",
    ) -> ProviderSelection:
        if request.capability is None:
            raise TaskExecutionError(
                "Provider capability is required for provider selection."
            )
        return self._provider_manager.select_provider(
            request.capability,
            preferred=request.provider_name,
        )


class ModelSelector:
    """Default model selection strategy."""

    async def select(
        self,
        request: ExecutionRequest,
        provider_selection: ProviderSelection,
    ) -> str | None:
        if request.model:
            return request.model
        models = provider_selection.record.metadata.models
        return models[0] if models else None

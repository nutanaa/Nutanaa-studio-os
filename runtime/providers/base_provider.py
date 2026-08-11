from __future__ import annotations

from abc import ABC
from collections.abc import AsyncIterator
from typing import Any

from runtime.contracts.i_provider import IProvider
from runtime.providers.provider_capability import ProviderCapability
from runtime.providers.provider_exceptions import ProviderCapabilityError
from runtime.providers.provider_health import HealthStatus, ProviderHealth
from runtime.providers.provider_metadata import ProviderMetadata
from runtime.providers.provider_response import ProviderResponse
from runtime.providers.provider_type import ProviderType


class BaseProvider(IProvider, ABC):
    """Convenience base class for provider implementations."""

    def __init__(self, metadata: ProviderMetadata) -> None:
        self._metadata = metadata
        self._initialized = False
        self._loaded_models: set[str] = set(metadata.models)

    @property
    def provider_id(self) -> str:
        return self._metadata.provider_id

    @property
    def provider_type(self) -> ProviderType:
        return self._metadata.provider_type

    @property
    def version(self) -> str:
        return self._metadata.version

    @property
    def capabilities(self) -> frozenset[ProviderCapability]:
        return self._metadata.capabilities

    @property
    def metadata(self) -> ProviderMetadata:
        return self._metadata

    @property
    def initialized(self) -> bool:
        return self._initialized

    async def initialize(self) -> None:
        self.validate_configuration()
        self._initialized = True

    async def shutdown(self) -> None:
        self._initialized = False

    async def health_check(self) -> bool:
        health = await self.health()
        return health.healthy

    async def chat(self, prompt: str, **kwargs: Any) -> ProviderResponse:
        self._require(ProviderCapability.TEXT)
        raise ProviderCapabilityError(
            self.provider_id,
            ProviderCapability.TEXT.value,
        )

    async def stream(self, prompt: str, **kwargs: Any) -> AsyncIterator[str]:
        self._require(ProviderCapability.STREAM)
        response = await self.chat(prompt, **kwargs)
        yield response.text

    async def embeddings(self, text: str, **kwargs: Any) -> list[float]:
        self._require(ProviderCapability.EMBEDDING)
        raise ProviderCapabilityError(
            self.provider_id,
            ProviderCapability.EMBEDDING.value,
        )

    async def vision(self, prompt: str, **kwargs: Any) -> ProviderResponse:
        self._require(ProviderCapability.IMAGE)
        raise ProviderCapabilityError(self.provider_id, ProviderCapability.IMAGE.value)

    async def audio(self, prompt: str, **kwargs: Any) -> ProviderResponse:
        self._require(ProviderCapability.AUDIO)
        raise ProviderCapabilityError(self.provider_id, ProviderCapability.AUDIO.value)

    async def video(self, prompt: str, **kwargs: Any) -> ProviderResponse:
        self._require(ProviderCapability.VIDEO)
        raise ProviderCapabilityError(self.provider_id, ProviderCapability.VIDEO.value)

    async def tool_call(self, tool_name: str, **kwargs: Any) -> ProviderResponse:
        self._require(ProviderCapability.TOOL_CALL)
        raise ProviderCapabilityError(
            self.provider_id,
            ProviderCapability.TOOL_CALL.value,
        )

    def supports(self, capability: ProviderCapability | str) -> bool:
        if isinstance(capability, str):
            try:
                capability = ProviderCapability(capability)
            except ValueError:
                return False
        return self._metadata.supports(capability)

    def validate_configuration(self) -> None:
        if not self.provider_id.strip():
            raise ValueError("provider_id must not be blank")
        if not self._metadata.name.strip():
            raise ValueError("provider name must not be blank")
        if not self.version.strip():
            raise ValueError("provider version must not be blank")

    async def health(self) -> ProviderHealth:
        status = HealthStatus.HEALTHY if self._initialized else HealthStatus.UNKNOWN
        return ProviderHealth(status=status)

    def _require(self, capability: ProviderCapability) -> None:
        if not self.supports(capability):
            raise ProviderCapabilityError(self.provider_id, capability.value)

    async def generate(self, prompt: str, **kwargs: Any) -> str:
        response = await self.chat(prompt, **kwargs)
        return response.text

    async def generate_stream(self, prompt: str, **kwargs: Any) -> AsyncIterator[str]:
        async for chunk in self.stream(prompt, **kwargs):
            yield chunk

    async def embed(self, text: str, **kwargs: Any) -> list[float]:
        return await self.embeddings(text, **kwargs)

    async def list_models(self) -> list[str]:
        return sorted(self._loaded_models or set(self._metadata.models))

    async def refresh_models(self) -> None:
        """Refresh model list. Default implementation is a no-op."""

    async def load_model(self, model_name: str) -> None:
        self._loaded_models.add(model_name)

    async def unload_model(self, model_name: str) -> None:
        self._loaded_models.discard(model_name)

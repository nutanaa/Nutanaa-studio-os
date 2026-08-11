from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from runtime.providers.provider_capability import ProviderCapability
    from runtime.providers.provider_metadata import ProviderMetadata
    from runtime.providers.provider_response import ProviderResponse
    from runtime.providers.provider_type import ProviderType


class IProvider(ABC):
    """Universal provider contract used by the runtime."""

    @property
    @abstractmethod
    def provider_id(self) -> str:
        """Return the stable provider identifier."""

    @property
    @abstractmethod
    def provider_type(self) -> ProviderType:
        """Return the provider type."""

    @property
    @abstractmethod
    def version(self) -> str:
        """Return the semantic version of the provider."""

    @property
    @abstractmethod
    def capabilities(self) -> frozenset[ProviderCapability]:
        """Return the capabilities supported by the provider."""

    @property
    @abstractmethod
    def metadata(self) -> ProviderMetadata:
        """Return the provider metadata."""

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize provider resources and client connections."""

    @abstractmethod
    async def shutdown(self) -> None:
        """Release provider resources and close connections."""

    @abstractmethod
    async def health_check(self) -> bool:
        """Return whether the provider is currently healthy."""

    @abstractmethod
    async def chat(self, prompt: str, **kwargs: Any) -> ProviderResponse:
        """Generate a structured response for a text prompt."""

    @abstractmethod
    async def stream(
        self,
        prompt: str,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        """Stream a text response for the provided prompt."""

    @abstractmethod
    async def embeddings(self, text: str, **kwargs: Any) -> list[float]:
        """Return an embedding vector for the supplied text."""

    @abstractmethod
    async def vision(self, prompt: str, **kwargs: Any) -> ProviderResponse:
        """Generate an image-oriented response."""

    @abstractmethod
    async def audio(self, prompt: str, **kwargs: Any) -> ProviderResponse:
        """Generate an audio-oriented response."""

    @abstractmethod
    async def video(self, prompt: str, **kwargs: Any) -> ProviderResponse:
        """Generate a video-oriented response."""

    @abstractmethod
    async def tool_call(self, tool_name: str, **kwargs: Any) -> ProviderResponse:
        """Invoke a tool capability exposed by the provider."""

    @abstractmethod
    def supports(self, capability: ProviderCapability | str) -> bool:
        """Return whether the provider supports a capability."""

    @abstractmethod
    def validate_configuration(self) -> None:
        """Validate provider configuration and raise on invalid values."""

    async def generate(self, prompt: str, **kwargs: Any) -> str:
        """Compatibility wrapper for text generation."""
        response = await self.chat(prompt, **kwargs)
        return response.text

    async def generate_stream(
        self,
        prompt: str,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        """Compatibility wrapper for text streaming."""
        async for chunk in self.stream(prompt, **kwargs):
            yield chunk

    async def embed(self, text: str, **kwargs: Any) -> list[float]:
        """Compatibility wrapper for embeddings generation."""
        return await self.embeddings(text, **kwargs)

    async def list_models(self) -> list[str]:
        """Return registered or embedded model names."""
        return list(self.metadata.models)

    async def refresh_models(self) -> None:
        """Refresh the provider's available model list. Default: no-op."""

    async def load_model(self, model_name: str) -> None:
        """Load a model into provider memory."""
        _ = model_name

    async def unload_model(self, model_name: str) -> None:
        """Unload a model from provider memory."""
        _ = model_name

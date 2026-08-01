from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import Any

from runtime.providers.base_provider import BaseProvider
from runtime.providers.provider_capability import ProviderCapability
from runtime.providers.provider_health import HealthStatus, ProviderHealth
from runtime.providers.provider_metadata import ProviderMetadata
from runtime.providers.provider_response import ProviderResponse
from runtime.providers.provider_type import ProviderType


class MockProvider(BaseProvider):
    """Deterministic provider used for tests and local development."""

    def __init__(self, metadata: ProviderMetadata | None = None) -> None:
        super().__init__(
            metadata
            or ProviderMetadata(
                provider_id="mock-provider",
                name="Mock Provider",
                provider_type=ProviderType.MOCK,
                version="0.1.0",
                capabilities=frozenset(
                    {
                        ProviderCapability.TEXT,
                        ProviderCapability.STREAM,
                        ProviderCapability.EMBEDDING,
                        ProviderCapability.IMAGE,
                        ProviderCapability.AUDIO,
                        ProviderCapability.VIDEO,
                        ProviderCapability.TOOL_CALL,
                        ProviderCapability.REASONING,
                        ProviderCapability.UPSCALE,
                        ProviderCapability.LIP_SYNC,
                        ProviderCapability.SPEECH,
                    }
                ),
                models=("mock-text", "mock-vision"),
                supports_streaming=True,
                description="Deterministic in-memory provider for tests.",
            )
        )
        self._health = ProviderHealth(status=HealthStatus.UNKNOWN)

    async def initialize(self) -> None:
        await super().initialize()
        self._health.mark(HealthStatus.HEALTHY, message="mock provider ready")

    async def shutdown(self) -> None:
        await super().shutdown()
        self._health.mark(HealthStatus.UNKNOWN, message="mock provider stopped")

    async def health(self) -> ProviderHealth:
        return self._health

    async def chat(self, prompt: str, **kwargs: Any) -> ProviderResponse:
        payload = {
            "prompt": prompt,
            "kwargs": dict(kwargs),
        }
        return ProviderResponse.ok(
            request_id=kwargs.get("request_id", "mock-request"),
            provider_id=self.provider_id,
            capability=ProviderCapability.TEXT,
            result=f"mock:{prompt}",
            metadata=payload,
            model="mock-text",
        )

    async def stream(self, prompt: str, **kwargs: Any) -> AsyncIterator[str]:
        text = f"mock:{prompt}"
        for chunk in text.split(":"):
            await asyncio.sleep(0)
            yield chunk

    async def embeddings(self, text: str, **kwargs: Any) -> list[float]:
        values = [float((ord(char) % 31) / 31.0) for char in text[:8]]
        return values or [0.0]

    async def vision(self, prompt: str, **kwargs: Any) -> ProviderResponse:
        return ProviderResponse.ok(
            request_id=kwargs.get("request_id", "mock-vision"),
            provider_id=self.provider_id,
            capability=ProviderCapability.IMAGE,
            result={"vision": prompt, "kwargs": dict(kwargs)},
            metadata={"mode": "vision"},
            model="mock-vision",
        )

    async def audio(self, prompt: str, **kwargs: Any) -> ProviderResponse:
        return ProviderResponse.ok(
            request_id=kwargs.get("request_id", "mock-audio"),
            provider_id=self.provider_id,
            capability=ProviderCapability.AUDIO,
            result={"audio": prompt, "kwargs": dict(kwargs)},
            metadata={"mode": "audio"},
            model="mock-audio",
        )

    async def video(self, prompt: str, **kwargs: Any) -> ProviderResponse:
        return ProviderResponse.ok(
            request_id=kwargs.get("request_id", "mock-video"),
            provider_id=self.provider_id,
            capability=ProviderCapability.VIDEO,
            result={"video": prompt, "kwargs": dict(kwargs)},
            metadata={"mode": "video"},
            model="mock-video",
        )

    async def tool_call(self, tool_name: str, **kwargs: Any) -> ProviderResponse:
        return ProviderResponse.ok(
            request_id=kwargs.get("request_id", "mock-tool"),
            provider_id=self.provider_id,
            capability=ProviderCapability.TOOL_CALL,
            result={"tool": tool_name, "kwargs": dict(kwargs)},
            metadata={"mode": "tool"},
            model="mock-tool",
        )

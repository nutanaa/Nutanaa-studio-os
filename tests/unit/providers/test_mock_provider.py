import asyncio

from runtime.providers import (
    MockProvider,
    ProviderCapability,
    ProviderMetadata,
    ProviderType,
)


def test_mock_provider_chat_and_embedding() -> None:
    provider = MockProvider(
        ProviderMetadata(
            provider_id="mock",
            name="Mock",
            provider_type=ProviderType.MOCK,
            capabilities=frozenset(
                {ProviderCapability.TEXT, ProviderCapability.EMBEDDING}
            ),
        )
    )

    async def _run() -> None:
        await provider.initialize()
        response = await provider.chat("hello")
        assert response.text == "mock:hello"
        embedding = await provider.embeddings("hello")
        assert len(embedding) > 0
        await provider.shutdown()

    asyncio.run(_run())

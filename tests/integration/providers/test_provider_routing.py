import asyncio

from runtime.providers import (
    MockProvider,
    ProviderCapability,
    ProviderManager,
    ProviderMetadata,
    ProviderRegistry,
    ProviderType,
)


def test_provider_routing_and_cache() -> None:
    registry = ProviderRegistry()
    if hasattr(registry, "clear"):
        registry.clear()
    manager = ProviderManager(registry=registry, default_provider="mock")
    manager.register(
        "mock",
        MockProvider(
            ProviderMetadata(
                provider_id="mock",
                name="Mock",
                provider_type=ProviderType.MOCK,
                capabilities=frozenset(
                    {
                        ProviderCapability.TEXT,
                        ProviderCapability.STREAM,
                        ProviderCapability.EMBEDDING,
                    }
                ),
            )
        ),
    )

    async def _run() -> None:
        await manager.initialize_all()
        response1 = await manager.chat("route-me", preferred="mock")
        response2 = await manager.chat("route-me", preferred="mock")
        assert response1.text == response2.text == "mock:route-me"
        embedding = await manager.embeddings("abc", preferred="mock")
        assert embedding
        await manager.shutdown_all()

    asyncio.run(_run())

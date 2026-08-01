import asyncio

from runtime.providers import (
    MockProvider,
    ProviderCapability,
    ProviderManager,
    ProviderMetadata,
    ProviderRegistry,
    ProviderType,
)


def test_manager_chat_with_fallback() -> None:
    registry = ProviderRegistry()
    if hasattr(registry, "clear"):
        registry.clear()
    manager = ProviderManager(registry=registry, default_provider="mock")
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
    manager.register("mock", provider)

    async def _run() -> None:
        await manager.initialize_all()
        response = await manager.chat("hello")
        assert response.text == "mock:hello"
        assert await manager.health_check("mock") is True
        await manager.shutdown_all()

    asyncio.run(_run())

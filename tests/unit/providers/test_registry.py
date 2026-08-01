import asyncio

from runtime.providers import (
    MockProvider,
    ProviderCapability,
    ProviderMetadata,
    ProviderRegistry,
    ProviderType,
)


def test_registry_discovery_and_health() -> None:
    registry = ProviderRegistry()
    registry.clear() if hasattr(registry, "clear") else None
    provider = MockProvider(
        ProviderMetadata(
            provider_id="mock",
            name="Mock",
            provider_type=ProviderType.MOCK,
            capabilities=frozenset(
                {ProviderCapability.TEXT, ProviderCapability.STREAM}
            ),
        )
    )
    registry.register_provider("mock", provider)
    assert registry.provider_exists("mock")
    assert registry.find_by_capability(ProviderCapability.TEXT)[0].name == "mock"

    async def _health() -> None:
        await provider.initialize()
        result = await registry.health_check_all()
        assert result["mock"] is True

    asyncio.run(_health())

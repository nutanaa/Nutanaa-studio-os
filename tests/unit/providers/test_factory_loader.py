from runtime.providers import (
    ProviderFactory,
    ProviderLoader,
    ProviderMetadata,
    ProviderType,
)


def test_factory_and_loader_create_mock_provider() -> None:
    loader = ProviderLoader()
    cls = loader.load_class("runtime.providers.mock_provider:MockProvider")
    assert cls.__name__ == "MockProvider"

    factory = ProviderFactory(loader=loader)
    metadata = ProviderMetadata(
        provider_id="mock",
        name="Mock",
        provider_type=ProviderType.MOCK,
    )
    provider = factory.create(ProviderType.MOCK, metadata=metadata)
    assert provider.provider_id == "mock"

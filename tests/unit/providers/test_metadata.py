from runtime.providers import ProviderCapability, ProviderMetadata, ProviderType


def test_metadata_supports_and_serialises() -> None:
    metadata = ProviderMetadata(
        provider_id="mock",
        name="Mock",
        provider_type=ProviderType.MOCK,
        version="1.0.0",
        capabilities=frozenset({ProviderCapability.TEXT, ProviderCapability.EMBEDDING}),
    )

    assert metadata.supports(ProviderCapability.TEXT)
    assert metadata.supports("embedding")
    assert not metadata.supports("image")

    payload = metadata.to_dict()
    assert payload["provider_id"] == "mock"
    assert payload["provider_type"] == "mock"

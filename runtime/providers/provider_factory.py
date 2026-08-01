from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from runtime.providers.base_provider import BaseProvider
from runtime.providers.mock_provider import MockProvider
from runtime.providers.provider_exceptions import ProviderLoadError
from runtime.providers.provider_loader import ProviderLoader
from runtime.providers.provider_metadata import ProviderMetadata
from runtime.providers.provider_type import ProviderType


class ProviderFactory:
    """Factory for creating provider instances."""

    def __init__(self, loader: ProviderLoader | None = None) -> None:
        self._loader = loader or ProviderLoader()
        self._registry: dict[ProviderType, type[BaseProvider]] = {
            ProviderType.MOCK: MockProvider,
            ProviderType.LOCAL: MockProvider,
        }

    def register(
        self,
        provider_type: ProviderType,
        provider_class: type[BaseProvider],
    ) -> None:
        """Register a provider implementation class."""
        self._registry[provider_type] = provider_class

    def create(
        self,
        provider_type: ProviderType,
        *,
        metadata: ProviderMetadata,
        **kwargs: Any,
    ) -> BaseProvider:
        """Create a provider by type."""
        provider_class = self._registry.get(provider_type)
        if provider_class is None:
            raise ProviderLoadError(
                provider_type.value,
                "provider type not registered",
            )
        return provider_class(metadata=metadata, **kwargs)

    def create_from_mapping(self, data: Mapping[str, Any]) -> BaseProvider:
        """Create a provider from a configuration mapping."""
        raw_type = data.get("provider_type", ProviderType.CUSTOM.value)
        if isinstance(raw_type, ProviderType):
            provider_type = raw_type
        else:
            provider_type = ProviderType(str(raw_type))
        metadata_data = dict(data.get("metadata", {}))
        metadata = ProviderMetadata.from_mapping(metadata_data)
        kwargs = dict(data.get("kwargs", {}))
        if provider_type in self._registry:
            return self.create(provider_type, metadata=metadata, **kwargs)
        if path := data.get("path"):
            return self._loader.load_provider(str(path), metadata=metadata, **kwargs)
        raise ProviderLoadError(
            str(provider_type.value),
            "no provider implementation configured",
        )

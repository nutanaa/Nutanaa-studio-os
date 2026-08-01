from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Self

from runtime.providers.provider_capability import ProviderCapability
from runtime.providers.provider_type import ProviderType


@dataclass(slots=True)
class ProviderMetadata:
    """Description of a provider registered in the runtime."""

    provider_id: str
    name: str
    provider_type: ProviderType = ProviderType.CUSTOM
    version: str = "0.1.0"
    capabilities: frozenset[ProviderCapability] = field(default_factory=frozenset)
    models: tuple[str, ...] = ()
    description: str = ""
    author: str = ""
    homepage: str = ""
    supports_streaming: bool = False
    enabled: bool = True
    extra: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.provider_id = str(self.provider_id).strip()
        self.name = str(self.name).strip()
        self.version = str(self.version).strip() or "0.1.0"
        self.provider_type = self._coerce_provider_type(self.provider_type)
        self.capabilities = frozenset(
            self._coerce_capability(item) for item in self.capabilities
        )
        self.models = tuple(str(model) for model in self.models)
        if not self.provider_id:
            raise ValueError("provider_id must not be blank")
        if not self.name:
            raise ValueError("name must not be blank")

    def supports(self, capability: ProviderCapability | str) -> bool:
        """Return whether the provider advertises a capability."""
        try:
            capability = self._coerce_capability(capability)
        except ValueError:
            return False
        return capability in self.capabilities

    def with_capability(self, capability: ProviderCapability) -> Self:
        """Return a copy with an extra capability."""
        capabilities = set(self.capabilities)
        capabilities.add(self._coerce_capability(capability))
        return self.__class__(
            provider_id=self.provider_id,
            name=self.name,
            provider_type=self.provider_type,
            version=self.version,
            capabilities=frozenset(capabilities),
            models=self.models,
            description=self.description,
            author=self.author,
            homepage=self.homepage,
            supports_streaming=self.supports_streaming,
            enabled=self.enabled,
            extra=dict(self.extra),
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialise the metadata into a dictionary."""
        return {
            "provider_id": self.provider_id,
            "name": self.name,
            "provider_type": self.provider_type.value,
            "version": self.version,
            "capabilities": [capability.value for capability in self.capabilities],
            "models": list(self.models),
            "description": self.description,
            "author": self.author,
            "homepage": self.homepage,
            "supports_streaming": self.supports_streaming,
            "enabled": self.enabled,
            "extra": dict(self.extra),
        }

    @classmethod
    def from_mapping(cls, data: dict[str, Any]) -> Self:
        """Construct metadata from a mapping."""
        raw_provider_type = data.get("provider_type", ProviderType.CUSTOM.value)
        raw_capabilities = data.get("capabilities", [])
        return cls(
            provider_id=str(data.get("provider_id", "")),
            name=str(data.get("name", "")),
            provider_type=cls._coerce_provider_type(raw_provider_type),
            version=str(data.get("version", "0.1.0")),
            capabilities=frozenset(
                cls._coerce_capability(item) for item in raw_capabilities
            ),
            models=tuple(str(item) for item in data.get("models", [])),
            description=str(data.get("description", "")),
            author=str(data.get("author", "")),
            homepage=str(data.get("homepage", "")),
            supports_streaming=bool(data.get("supports_streaming", False)),
            enabled=bool(data.get("enabled", True)),
            extra=dict(data.get("extra", {})),
        )

    @staticmethod
    def _coerce_provider_type(value: ProviderType | str) -> ProviderType:
        if isinstance(value, ProviderType):
            return value
        return ProviderType(str(value))

    @staticmethod
    def _coerce_capability(value: ProviderCapability | str) -> ProviderCapability:
        if isinstance(value, ProviderCapability):
            return value
        return ProviderCapability(str(value))

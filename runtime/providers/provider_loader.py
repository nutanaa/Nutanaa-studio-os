from __future__ import annotations

import importlib
from collections.abc import Mapping
from typing import Any, TypeVar

from runtime.providers.base_provider import BaseProvider
from runtime.providers.provider_exceptions import ProviderLoadError

TProvider = TypeVar("TProvider", bound=BaseProvider)


class ProviderLoader:
    """Dynamically load provider classes and instances."""

    def load_class(self, dotted_path: str) -> type[BaseProvider]:
        """Load a provider class from a dotted module path."""
        module_path, sep, class_name = dotted_path.rpartition(":")
        if not sep:
            module_path, sep, class_name = dotted_path.rpartition(".")
        if not module_path or not class_name:
            raise ProviderLoadError(dotted_path, "invalid dotted path")
        try:
            module = importlib.import_module(module_path)
            cls = getattr(module, class_name)
        except Exception as exc:  # pragma: no cover - defensive
            raise ProviderLoadError(dotted_path, str(exc)) from exc
        if not isinstance(cls, type) or not issubclass(cls, BaseProvider):
            raise ProviderLoadError(dotted_path, "loaded object is not a provider")
        return cls

    def load_provider(self, dotted_path: str, **kwargs: Any) -> BaseProvider:
        """Instantiate a provider from a dotted path."""
        provider_class = self.load_class(dotted_path)
        try:
            return provider_class(**kwargs)
        except Exception as exc:  # pragma: no cover - defensive
            raise ProviderLoadError(dotted_path, str(exc)) from exc

    def load_from_mapping(self, data: Mapping[str, Any]) -> BaseProvider:
        """Instantiate a provider from a configuration mapping."""
        path = str(data.get("path", ""))
        kwargs = dict(data.get("kwargs", {}))
        return self.load_provider(path, **kwargs)

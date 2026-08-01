from __future__ import annotations

import importlib
from dataclasses import dataclass

from runtime.contracts.i_plugin import IPlugin
from runtime.plugins.plugin_exceptions import PluginLoaderError


@dataclass(slots=True)
class LoadedPlugin:
    """Loaded plugin artifact."""

    plugin: IPlugin
    source: str


class PluginLoader:
    """Loads plugins from dotted paths or module objects."""

    def load(self, target: str, attribute: str | None = None) -> LoadedPlugin:
        try:
            module = importlib.import_module(target)
            if attribute is None:
                attribute = "PLUGIN"
            plugin = getattr(module, attribute)
            if isinstance(plugin, IPlugin):
                return LoadedPlugin(plugin=plugin, source=target)
            if callable(plugin):
                candidate = plugin()
                if isinstance(candidate, IPlugin):
                    return LoadedPlugin(plugin=candidate, source=target)
            raise PluginLoaderError(f"Target '{target}' did not yield a plugin")
        except Exception as exc:  # pragma: no cover - defensive
            if isinstance(exc, PluginLoaderError):
                raise
            raise PluginLoaderError(str(exc)) from exc

from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock
from typing import Any

from runtime.contracts.i_plugin import IPlugin
from runtime.plugins.plugin_exceptions import PluginRegistryError
from runtime.plugins.plugin_manifest import PluginManifest
from runtime.plugins.plugin_types import PluginStatus


@dataclass(slots=True)
class PluginRecord:
    """Internal plugin registry record."""

    name: str
    plugin: IPlugin
    manifest: PluginManifest
    status: PluginStatus = PluginStatus.DISCOVERED
    metadata: dict[str, Any] = field(default_factory=dict)


class PluginRegistry:
    """Thread-safe registry for plugins."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._records: dict[str, PluginRecord] = {}

    def register(
        self,
        name: str,
        plugin: IPlugin,
        manifest: PluginManifest,
    ) -> PluginRecord:
        with self._lock:
            if name in self._records:
                raise PluginRegistryError(f"Plugin already registered: '{name}'")
            record = PluginRecord(name=name, plugin=plugin, manifest=manifest)
            self._records[name] = record
            return record

    def unregister(self, name: str) -> None:
        with self._lock:
            self._records.pop(name, None)

    def get(self, name: str) -> IPlugin:
        with self._lock:
            record = self._records.get(name)
        if record is None:
            raise PluginRegistryError(f"Plugin not found: '{name}'")
        return record.plugin

    def get_record(self, name: str) -> PluginRecord:
        with self._lock:
            record = self._records.get(name)
        if record is None:
            raise PluginRegistryError(f"Plugin not found: '{name}'")
        return record

    def exists(self, name: str) -> bool:
        with self._lock:
            return name in self._records

    def list_plugins(self) -> list[str]:
        with self._lock:
            return list(self._records.keys())

    def list_records(self) -> list[PluginRecord]:
        with self._lock:
            return list(self._records.values())

    def set_status(self, name: str, status: PluginStatus) -> None:
        with self._lock:
            self._records[name].status = status

    def clear(self) -> None:
        with self._lock:
            self._records.clear()

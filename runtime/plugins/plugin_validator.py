from __future__ import annotations

from runtime.contracts.i_plugin import IPlugin
from runtime.plugins.plugin_exceptions import PluginManifestError
from runtime.plugins.plugin_manifest import PluginManifest


class PluginValidator:
    """Validates plugins and manifests."""

    REQUIRED_MANIFEST_FIELDS = ("name", "version")

    def validate_manifest(self, manifest: PluginManifest) -> None:
        for field_name in self.REQUIRED_MANIFEST_FIELDS:
            if not getattr(manifest, field_name):
                raise PluginManifestError(f"Missing manifest field: {field_name}")

    def validate_plugin(self, plugin: IPlugin) -> None:
        for method in (
            "install",
            "uninstall",
            "enable",
            "disable",
            "metadata",
            "dependencies",
            "version",
            "health_check",
        ):
            if not hasattr(plugin, method):
                raise PluginManifestError(f"Plugin missing method: {method}")

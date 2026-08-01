from __future__ import annotations

import asyncio
from pathlib import Path

from runtime.plugins import (
    CallablePlugin,
    PluginDiscovery,
    PluginLifecycle,
    PluginLoader,
    PluginManifest,
    PluginRegistry,
    PluginRuntime,
    PluginStatus,
)


def test_callable_plugin_lifecycle() -> None:
    plugin = CallablePlugin(
        name="demo",
        version_value="1.0.0",
        install_hook=lambda: None,
        enable_hook=lambda: None,
        disable_hook=lambda: None,
        uninstall_hook=lambda: None,
        health_hook=lambda: True,
    )
    assert plugin.metadata()["name"] == "demo"
    assert asyncio.run(plugin.health_check()) is True


def test_plugin_registry_and_runtime() -> None:
    registry = PluginRegistry()
    plugin = CallablePlugin(name="demo", version_value="1.0.0")
    manifest = PluginManifest(name="demo", version="1.0.0")
    record = registry.register("demo", plugin, manifest)
    assert record.name == "demo"
    assert registry.exists("demo")

    runtime = PluginRuntime(name="demo", plugin=plugin, manifest=manifest)
    asyncio.run(runtime.install())
    asyncio.run(runtime.enable())
    assert runtime.status == PluginStatus.ENABLED


def test_plugin_loader_and_discovery(tmp_path: Path, monkeypatch) -> None:
    module_path = tmp_path / "sample_plugin.py"
    module_path.write_text(
        """
from runtime.plugins import CallablePlugin

PLUGIN = CallablePlugin(name='sample', version_value='1.0.0')
""".strip(),
        encoding="utf-8",
    )
    monkeypatch.syspath_prepend(str(tmp_path))

    loader = PluginLoader()
    loaded = loader.load("sample_plugin", "PLUGIN")
    assert loaded.plugin.metadata()["name"] == "sample"

    discovered = PluginDiscovery().discover(tmp_path)
    assert any(item.path.endswith("sample_plugin.py") for item in discovered)


def test_plugin_lifecycle() -> None:
    registry = PluginRegistry()
    plugin = CallablePlugin(name="demo", version_value="1.0.0")
    manifest = PluginManifest(name="demo", version="1.0.0")
    lifecycle = PluginLifecycle(registry)
    asyncio.run(lifecycle.install("demo", plugin, manifest))
    asyncio.run(lifecycle.enable("demo"))
    asyncio.run(lifecycle.disable("demo"))
    asyncio.run(lifecycle.uninstall("demo"))

    assert not registry.exists("demo")

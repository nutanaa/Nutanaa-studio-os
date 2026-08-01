from __future__ import annotations

import inspect
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from runtime.contracts.i_plugin import IPlugin

AsyncVoidHook = Callable[[], Any | Awaitable[Any]]
MetadataHook = Callable[[], dict[str, Any] | Awaitable[dict[str, Any]]]
DependenciesHook = Callable[[], list[str] | Awaitable[list[str]]]
VersionHook = Callable[[], str | Awaitable[str]]
HealthHook = Callable[[], bool | Awaitable[bool]]


@dataclass(slots=True)
class CallablePlugin(IPlugin):
    """Plugin implementation backed by callables."""

    name: str
    version_value: str
    metadata_hook: MetadataHook | None = None
    dependencies_hook: DependenciesHook | None = None
    install_hook: AsyncVoidHook | None = None
    uninstall_hook: AsyncVoidHook | None = None
    enable_hook: AsyncVoidHook | None = None
    disable_hook: AsyncVoidHook | None = None
    health_hook: HealthHook | None = None

    async def install(self) -> None:
        if self.install_hook is not None:
            result = self.install_hook()
            if inspect.isawaitable(result):
                await result

    async def uninstall(self) -> None:
        if self.uninstall_hook is not None:
            result = self.uninstall_hook()
            if inspect.isawaitable(result):
                await result

    async def enable(self) -> None:
        if self.enable_hook is not None:
            result = self.enable_hook()
            if inspect.isawaitable(result):
                await result

    async def disable(self) -> None:
        if self.disable_hook is not None:
            result = self.disable_hook()
            if inspect.isawaitable(result):
                await result

    def metadata(self) -> dict[str, Any]:
        if self.metadata_hook is None:
            return {"name": self.name, "version": self.version_value}
        result = self.metadata_hook()
        if inspect.isawaitable(result):
            raise RuntimeError("metadata_hook must be synchronous for this plugin")
        return result

    def dependencies(self) -> list[str]:
        if self.dependencies_hook is None:
            return []
        result = self.dependencies_hook()
        if inspect.isawaitable(result):
            raise RuntimeError("dependencies_hook must be synchronous for this plugin")
        return list(result)

    def version(self) -> str:
        return self.version_value

    async def health_check(self) -> bool:
        if self.health_hook is None:
            return True
        result = self.health_hook()
        if inspect.isawaitable(result):
            result = await result
        return bool(result)

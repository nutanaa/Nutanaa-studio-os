from __future__ import annotations

from collections.abc import AsyncIterator, Iterable
from typing import Any


class ProviderStream:
    """Convenience wrapper for streaming provider chunks."""

    def __init__(self, iterator: AsyncIterator[Any]) -> None:
        self._iterator = iterator

    def __aiter__(self) -> AsyncIterator[Any]:
        return self._iterator

    async def collect(self) -> list[Any]:
        """Collect all streamed items into a list."""
        items: list[Any] = []
        async for chunk in self._iterator:
            items.append(chunk)
        return items

    @classmethod
    def from_iterable(cls, items: Iterable[Any]) -> "ProviderStream":
        """Create a stream from a synchronous iterable."""

        async def _iterator() -> AsyncIterator[Any]:
            for item in items:
                yield item

        return cls(_iterator())

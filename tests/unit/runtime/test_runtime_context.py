from __future__ import annotations

import pytest

from runtime.bootstrap import bootstrap
from runtime.context import (
    clear_runtime_context,
    get_runtime_context,
    set_runtime_context,
)


def test_runtime_context_set_and_get() -> None:
    context = bootstrap()
    set_runtime_context(context)

    assert get_runtime_context() is context

    clear_runtime_context()
    with pytest.raises(RuntimeError):
        get_runtime_context()

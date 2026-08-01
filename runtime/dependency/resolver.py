from __future__ import annotations

import inspect
import sys
from typing import Any, get_type_hints

from runtime.dependency.exceptions import (
    CircularDependencyError,
    DependencyResolutionError,
    ServiceNotRegisteredError,
)


class DependencyResolver:
    """Constructs objects by resolving their annotated constructor arguments."""

    def __init__(
        self,
        container: "DependencyContainer",
        scope: "DependencyScope | None" = None,
        stack: list[str] | None = None,
    ) -> None:
        self._container = container
        self._scope = scope
        self._stack = stack if stack is not None else []

    def create(self, cls: type[Any]) -> Any:
        """Instantiate *cls* using constructor injection."""
        if not inspect.isclass(cls):
            raise TypeError(f"DependencyResolver can only create classes, got {cls!r}")

        target = _type_key(cls)
        if target in self._stack:
            raise CircularDependencyError(self._stack + [target])

        self._stack.append(target)
        try:
            signature = inspect.signature(cls.__init__)
            hints = get_type_hints(
                cls.__init__,
                globalns=sys.modules[cls.__module__].__dict__,
                localns=dict(vars(cls)),
            )

            kwargs: dict[str, Any] = {}
            for name, parameter in signature.parameters.items():
                if name == "self":
                    continue
                if parameter.kind in (
                    inspect.Parameter.VAR_POSITIONAL,
                    inspect.Parameter.VAR_KEYWORD,
                ):
                    continue

                annotation = hints.get(name, parameter.annotation)
                if annotation is inspect.Parameter.empty:
                    if parameter.default is inspect.Parameter.empty:
                        raise DependencyResolutionError(
                            target,
                            f"Parameter '{name}' has no type annotation",
                        )
                    continue

                if annotation is Any:
                    if parameter.default is inspect.Parameter.empty:
                        raise DependencyResolutionError(
                            target,
                            f"Parameter '{name}' cannot be resolved from Any",
                        )
                    continue

                if not self._container.is_registered(annotation):
                    if parameter.default is inspect.Parameter.empty:
                        raise ServiceNotRegisteredError(annotation)
                    continue

                kwargs[name] = self._container.resolve(
                    annotation,
                    scope=self._scope,
                    _stack=self._stack,
                )

            try:
                return cls(**kwargs)
            except Exception as exc:
                raise DependencyResolutionError(target, str(exc)) from exc
        finally:
            self._stack.pop()


def _type_key(value: type[Any]) -> str:
    """Derive a stable registry key for a type."""
    return f"{value.__module__}.{value.__qualname__}"


if False:  # pragma: no cover
    from runtime.dependency.container import DependencyContainer
    from runtime.dependency.scope import DependencyScope

from __future__ import annotations

from runtime.dependency.container import DependencyContainer


class Foo:
    pass


class Bar:
    pass


class Baz:
    def __init__(self, foo: Foo) -> None:
        self.foo = foo


def test_register_singleton() -> None:
    container = DependencyContainer()
    container.register(Foo)

    a = container.resolve(Foo)
    b = container.resolve(Foo)

    assert a is b


def test_register_transient() -> None:
    container = DependencyContainer()
    container.register(Bar, singleton=False)

    a = container.resolve(Bar)
    b = container.resolve(Bar)

    assert a is not b


def test_register_instance() -> None:
    container = DependencyContainer()
    instance = Foo()

    container.register_instance(Foo, instance)

    assert container.resolve(Foo) is instance


def test_resolve_nested_dependency() -> None:
    container = DependencyContainer()
    container.register(Foo)
    container.register(Baz, singleton=False)

    baz = container.resolve(Baz)

    assert isinstance(baz.foo, Foo)


def test_scope_caches_scoped_instances() -> None:
    container = DependencyContainer()
    container.register(Foo, singleton=False)

    scope = container.create_scope()

    a = scope.resolve(Foo)
    b = scope.resolve(Foo)

    assert a is not b

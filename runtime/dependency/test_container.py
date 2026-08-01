from runtime.dependency import DependencyContainer


class Foo:
    pass


class Bar:
    pass


def test_register_singleton():

    container = DependencyContainer()

    container.register_singleton(Foo)

    a = container.resolve(Foo)
    b = container.resolve(Foo)

    assert a is b


def test_register_transient():

    container = DependencyContainer()

    container.register_transient(Bar)

    a = container.resolve(Bar)
    b = container.resolve(Bar)

    assert a is not b


def test_is_registered():

    container = DependencyContainer()

    container.register_singleton(Foo)

    assert container.is_registered(Foo)

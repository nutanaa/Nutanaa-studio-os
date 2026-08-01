from runtime.services.service_registry import ServiceRegistry


def test_registry():

    registry = ServiceRegistry()

    registry.register("x", object())

    assert registry.exists("x")

from runtime.services.runtime_health import RuntimeHealth


def test_health():

    health = RuntimeHealth()

    assert health.healthy

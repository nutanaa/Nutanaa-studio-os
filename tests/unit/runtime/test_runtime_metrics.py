from runtime.services.runtime_metrics import RuntimeMetrics


def test_uptime():

    metrics = RuntimeMetrics()

    assert metrics.uptime() >= 0

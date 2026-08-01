from runtime.bootstrap import RuntimeBuilder


def test_runtime_builder():

    runtime = RuntimeBuilder().build()

    assert runtime is not None

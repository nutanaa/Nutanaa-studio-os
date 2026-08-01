from runtime.bootstrap import RuntimeBuilder
from runtime.context import get_runtime_context


def test_runtime_context():

    RuntimeBuilder().build()

    context = get_runtime_context()

    assert context.provider_manager is not None
    assert context.workflow_manager is not None
    assert context.agent_manager is not None

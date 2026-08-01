from __future__ import annotations

import asyncio

from runtime.workflows import (
    Workflow,
    WorkflowContext,
    WorkflowDeserializer,
    WorkflowNodeType,
    WorkflowSerializer,
)


def test_workflow_graph_and_execution() -> None:
    context = WorkflowContext(workflow_id="wf-1")
    builder = Workflow.builder("wf-1", context)
    runner = (
        builder.add_node(
            "step-1",
            "step-1",
            WorkflowNodeType.FUNCTION,
            action=lambda _ctx, _inputs: 1,
        )
        .add_node(
            "step-2",
            "step-2",
            WorkflowNodeType.FUNCTION,
            action=lambda _ctx, inputs: inputs["step-1"] + 1,
            dependencies=("step-1",),
        )
        .build()
    )
    result = asyncio.run(runner.run())

    assert result.status.value == "completed"
    assert result.outputs["step-1"] == 1
    assert result.outputs["step-2"] == 2


def test_workflow_serialization_roundtrip() -> None:
    context = WorkflowContext(workflow_id="wf-2")
    builder = Workflow.builder("wf-2", context)
    runner = builder.add_node(
        "step-1",
        "step-1",
        WorkflowNodeType.FUNCTION,
        action=lambda _ctx, _inputs: "ok",
    ).build()
    payload = runner.serialise_state()
    graph_payload = WorkflowSerializer().graph_to_dict(runner.graph)
    graph = WorkflowDeserializer().graph_from_dict(graph_payload)

    assert graph.workflow_id == "wf-2"
    assert payload["state"]["status"] == "idle"


def test_workflow_save_and_load_state() -> None:
    context = WorkflowContext(workflow_id="wf-3")
    builder = Workflow.builder("wf-3", context)
    workflow = builder.add_node(
        "step-1",
        "step-1",
        WorkflowNodeType.FUNCTION,
        action=lambda _ctx, _inputs: "ok",
    ).build()
    state = workflow.serialise_state()
    workflow.deserialise_state(state)
    assert workflow.state.status.value == "idle"

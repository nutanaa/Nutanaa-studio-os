from __future__ import annotations

import asyncio

from runtime.agents import (
    AgentOrchestrator,
    AgentPriority,
    AgentRegistry,
    AgentScheduler,
    AgentTask,
    CallableAgent,
)


def test_callable_agent_lifecycle() -> None:
    agent = CallableAgent(
        name="echo",
        execute_hook=lambda input_data: f"echo:{input_data}",
    )
    asyncio.run(agent.initialize())
    assert asyncio.run(agent.execute("x")) == "echo:x"
    assert asyncio.run(agent.status()) == "completed"
    asyncio.run(agent.shutdown())
    assert asyncio.run(agent.status()) == "idle"


def test_agent_registry_and_scheduler() -> None:
    registry = AgentRegistry()
    agent = CallableAgent(name="echo", execute_hook=lambda input_data: input_data)
    registry.register("echo", agent)

    scheduler = AgentScheduler(registry)
    asyncio.run(
        scheduler.submit(
            AgentTask(
                task_id="1",
                agent_name="echo",
                input_data="a",
                priority=AgentPriority(10),
            )
        )
    )
    asyncio.run(
        scheduler.submit(
            AgentTask(
                task_id="2",
                agent_name="echo",
                input_data="b",
                priority=AgentPriority(1),
            )
        )
    )
    results = asyncio.run(scheduler.run_all())

    assert [r.output for r in results] == ["a", "b"]


def test_agent_orchestrator_runs_agent() -> None:
    registry = AgentRegistry()
    agent = CallableAgent(
        name="echo",
        execute_hook=lambda input_data: input_data.upper(),
    )
    registry.register("echo", agent)
    scheduler = AgentScheduler(registry)
    orchestrator = AgentOrchestrator(registry=registry, scheduler=scheduler)

    result = asyncio.run(orchestrator.run_agent("echo", "hello"))
    assert result.output == "HELLO"
    assert result.status.value == "completed"

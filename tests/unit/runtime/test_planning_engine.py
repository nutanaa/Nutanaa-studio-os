from __future__ import annotations

import asyncio

from runtime import bootstrap

from runtime.planning import (
    AgentPlanner,
    ComplexityAnalyzer,
    ExecutionPlan,
    IntentAnalyzer,
    IntentCategory,
    PlanningEngine,
    ProviderPlanner,
    ToolPlanner,
    ToolType,
)
from runtime.planning.models import ComplexityLevel
from runtime.tasks.execution_context import ExecutionContext
from runtime.tasks.execution_request import ExecutionRequest


def test_intent_analyzer_detects_coding_intent() -> None:
    analyzer = IntentAnalyzer()
    request = ExecutionRequest(prompt="Write a python function to sort a list.")
    assert analyzer.analyze(request) == IntentCategory.CODING


def test_complexity_analyzer_estimates_complexity() -> None:
    analyzer = ComplexityAnalyzer()
    request = ExecutionRequest(prompt="Design a scalable microservices architecture for an ecommerce platform.")
    complexity = analyzer.analyze(request, IntentCategory.ARCHITECTURE)
    assert complexity in {ComplexityLevel.COMPLEX, ComplexityLevel.MULTI_AGENT, ComplexityLevel.LONG_RUNNING}


def test_tool_planner_recommends_debugging_tools() -> None:
    planner = ToolPlanner()
    tools = planner.plan_tools(
        intent=IntentCategory.DEBUGGING,
        complexity=ComplexityLevel.COMPLEX,
        prompt="Debug the failing unit tests in the python repository.",
    )
    tool_names = {tool.tool for tool in tools}
    assert {ToolType.WORKSPACE_INDEXING, ToolType.TERMINAL}.issubset(tool_names)


def test_agent_planner_recommends_coding_agent() -> None:
    planner = AgentPlanner()
    agents = planner.plan_agents(intent=IntentCategory.CODING, complexity=ComplexityLevel.MEDIUM)
    assert "Coding Agent" in agents


def test_provider_planner_infers_provider_from_intent() -> None:
    context = bootstrap(log_level="INFO")
    planner = ProviderPlanner()
    request = ExecutionRequest(prompt="Write a unit test for this function.")
    providers = planner.plan_providers(
        request=request,
        intent=IntentCategory.TESTING,
        provider_manager=context.provider_manager,
    )
    assert isinstance(providers, list)


def test_planning_engine_creates_execution_plan() -> None:
    context = bootstrap(log_level="INFO")
    execution_context = ExecutionContext(
        request=ExecutionRequest(prompt="Create documentation for the new feature."),
        provider_manager=context.provider_manager,
        agent_manager=context.agent_manager,
        event_bus=context.event_bus,
        state_store=context.kernel.state_store,
        telemetry=context.kernel.telemetry,
    )
    engine = PlanningEngine()
    plan = __import__("asyncio").new_event_loop().run_until_complete(
        engine.create_plan(execution_context.request, execution_context)
    )
    assert isinstance(plan, ExecutionPlan)
    assert plan.intent == IntentCategory.DOCUMENTATION
    assert plan.goal.startswith("Create documentation")

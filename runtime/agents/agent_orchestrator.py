from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from runtime.agents.agent_context import AgentContext
from runtime.agents.agent_registry import AgentRegistry
from runtime.agents.agent_result import AgentResult
from runtime.agents.agent_scheduler import AgentScheduler
from runtime.agents.agent_task import AgentTask
from runtime.agents.agent_types import AgentStatus
from runtime.events.event_bus import Event, EventBus


@dataclass(slots=True)
class AgentOrchestrator:
    """Coordinates agents, memory, and scheduling."""

    registry: AgentRegistry
    scheduler: AgentScheduler
    event_bus: EventBus | None = None

    def create_context(self, agent_name: str) -> AgentContext:
        return AgentContext(agent_name=agent_name)

    async def run_agent(self, agent_name: str, input_data: Any) -> AgentResult:
        agent = self.registry.get(agent_name)
        _context = self.create_context(agent_name)
        await agent.validate()
        await agent.initialize()
        try:
            output = await agent.execute(input_data)
            result = AgentResult(
                agent_name=agent_name,
                status=AgentStatus.COMPLETED,
                output=output,
            )
            if self.event_bus is not None:
                await self.event_bus.publish(
                    Event(
                        type="agent.completed",
                        source="agent",
                        subject_id=agent_name,
                        payload={"output": output},
                    )
                )
            return result
        except Exception as exc:  # pragma: no cover - defensive
            if self.event_bus is not None:
                await self.event_bus.publish(
                    Event(
                        type="agent.failed",
                        source="agent",
                        subject_id=agent_name,
                        payload={"error": str(exc)},
                    )
                )
            return AgentResult(
                agent_name=agent_name,
                status=AgentStatus.FAILED,
                error=str(exc),
            )
        finally:
            await agent.shutdown()

    async def submit(self, task: AgentTask) -> None:
        await self.scheduler.submit(task)

    async def run_queued(self) -> list[AgentResult]:
        return await self.scheduler.run_all()

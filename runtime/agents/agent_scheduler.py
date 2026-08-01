from __future__ import annotations

import asyncio
import heapq
import itertools

from runtime.agents.agent_exceptions import AgentSchedulerError
from runtime.agents.agent_registry import AgentRegistry
from runtime.agents.agent_result import AgentResult
from runtime.agents.agent_task import AgentTask
from runtime.agents.agent_types import AgentStatus


class AgentScheduler:
    """Priority scheduler for agent tasks."""

    def __init__(self, registry: AgentRegistry) -> None:
        self._registry = registry
        self._queue: list[tuple[int, int, AgentTask]] = []
        self._sequence = itertools.count()
        self._lock = asyncio.Lock()

    async def submit(self, task: AgentTask) -> None:
        """Submit a task to the scheduler."""
        async with self._lock:
            heapq.heappush(
                self._queue,
                (-int(task.priority.value), next(self._sequence), task),
            )

    async def next_task(self) -> AgentTask | None:
        """Pop the next scheduled task."""
        async with self._lock:
            if not self._queue:
                return None
            return heapq.heappop(self._queue)[2]

    async def run_next(self) -> AgentResult | None:
        """Run the next available task."""
        task = await self.next_task()
        if task is None:
            return None
        agent = self._registry.get(task.agent_name)
        try:
            await agent.validate()
            await agent.initialize()
            output = await agent.execute(task.input_data)
            status = AgentStatus.COMPLETED
            return AgentResult(
                agent_name=task.agent_name,
                status=status,
                output=output,
            )
        except Exception as exc:  # pragma: no cover - defensive
            raise AgentSchedulerError(str(exc)) from exc
        finally:
            try:
                await agent.shutdown()
            except Exception:
                pass

    async def run_all(self) -> list[AgentResult]:
        """Run every queued task."""
        results: list[AgentResult] = []
        while True:
            result = await self.run_next()
            if result is None:
                break
            results.append(result)
        return results

    async def clear(self) -> None:
        async with self._lock:
            self._queue.clear()

    def queued(self) -> int:
        return len(self._queue)

from __future__ import annotations

import logging
from threading import RLock
from typing import Any

from runtime.constants import (
    AGENT_STATUS_CANCELLED,
    AGENT_STATUS_COMPLETED,
    AGENT_STATUS_ERROR,
    AGENT_STATUS_IDLE,
    AGENT_STATUS_PAUSED,
    AGENT_STATUS_RUNNING,
)
from runtime.contracts.i_agent import IAgent
from runtime.exceptions.agent_exception import (
    AgentExecutionError,
    AgentInitError,
    AgentNotFoundError,
)

logger = logging.getLogger(__name__)


class AgentManager:
    """Manages agent registration, lifecycle, and execution."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._agents: dict[str, IAgent] = {}
        self._statuses: dict[str, str] = {}

    def register(self, name: str, agent: IAgent) -> None:
        """Register an agent instance."""
        with self._lock:
            self._agents[name] = agent
            self._statuses[name] = AGENT_STATUS_IDLE
        logger.info("Registered agent: '%s'", name)

    def unregister(self, name: str) -> None:
        """Remove an agent from the registry."""
        with self._lock:
            self._agents.pop(name, None)
            self._statuses.pop(name, None)
        logger.info("Unregistered agent: '%s'", name)

    def get(self, name: str) -> IAgent:
        """Return a registered agent by name."""
        with self._lock:
            agent = self._agents.get(name)
        if agent is None:
            raise AgentNotFoundError(name)
        return agent

    def list_agents(self) -> list[str]:
        """Return all registered agent names."""
        with self._lock:
            return list(self._agents.keys())

    async def initialize(self, name: str) -> None:
        """Initialise an agent."""
        agent = self.get(name)
        try:
            await agent.validate()
            await agent.initialize()
            with self._lock:
                self._statuses[name] = AGENT_STATUS_IDLE
            logger.info("Initialised agent: '%s'", name)
        except Exception as exc:
            with self._lock:
                self._statuses[name] = AGENT_STATUS_ERROR
            raise AgentInitError(name, str(exc)) from exc

    async def initialize_all(self) -> None:
        """Initialise every registered agent."""
        for name in self.list_agents():
            await self.initialize(name)

    async def execute(self, name: str, input_data: Any) -> Any:
        """Execute an agent with the given input."""
        agent = self.get(name)
        with self._lock:
            self._statuses[name] = AGENT_STATUS_RUNNING
        try:
            result = await agent.execute(input_data)
            with self._lock:
                self._statuses[name] = AGENT_STATUS_COMPLETED
            logger.debug("Agent '%s' executed successfully", name)
            return result
        except Exception as exc:
            with self._lock:
                self._statuses[name] = AGENT_STATUS_ERROR
            raise AgentExecutionError(name, str(exc)) from exc

    async def pause(self, name: str) -> None:
        """Pause an agent's execution."""
        agent = self.get(name)
        await agent.pause()
        with self._lock:
            self._statuses[name] = AGENT_STATUS_PAUSED
        logger.info("Paused agent: '%s'", name)

    async def resume(self, name: str) -> None:
        """Resume a paused agent."""
        agent = self.get(name)
        await agent.resume()
        with self._lock:
            self._statuses[name] = AGENT_STATUS_RUNNING
        logger.info("Resumed agent: '%s'", name)

    async def cancel(self, name: str) -> None:
        """Cancel an agent's in-flight execution."""
        agent = self.get(name)
        await agent.cancel()
        with self._lock:
            self._statuses[name] = AGENT_STATUS_CANCELLED
        logger.info("Cancelled agent: '%s'", name)

    async def status(self, name: str) -> str:
        """Return the current status of an agent."""
        agent = self.get(name)
        try:
            return await agent.status()
        except Exception:  # pragma: no cover - fallback path
            with self._lock:
                return self._statuses.get(name, AGENT_STATUS_IDLE)

    async def shutdown(self, name: str) -> None:
        """Shut down a single agent."""
        agent = self.get(name)
        try:
            await agent.shutdown()
            with self._lock:
                self._statuses[name] = AGENT_STATUS_IDLE
            logger.info("Shut down agent: '%s'", name)
        except Exception as exc:  # noqa: BLE001
            with self._lock:
                self._statuses[name] = AGENT_STATUS_ERROR
            logger.warning("Error shutting down agent '%s': %s", name, exc)

    async def shutdown_all(self) -> None:
        """Shut down all registered agents."""
        for name in self.list_agents():
            await self.shutdown(name)

    def statuses(self) -> dict[str, str]:
        """Return a copy of the current agent statuses."""
        with self._lock:
            return dict(self._statuses)

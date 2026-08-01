from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock
from typing import Any

from runtime.agents.agent_exceptions import AgentRegistryError
from runtime.contracts.i_agent import IAgent


@dataclass(slots=True)
class AgentRecord:
    """Internal registry record for an agent."""

    name: str
    agent: IAgent
    metadata: dict[str, Any] = field(default_factory=dict)


class AgentRegistry:
    """Thread-safe registry of agents."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._records: dict[str, AgentRecord] = {}

    def register(
        self,
        name: str,
        agent: IAgent,
        metadata: dict[str, Any] | None = None,
    ) -> AgentRecord:
        with self._lock:
            if name in self._records:
                raise AgentRegistryError(f"Agent already registered: '{name}'")
            record = AgentRecord(name=name, agent=agent, metadata=dict(metadata or {}))
            self._records[name] = record
            return record

    def unregister(self, name: str) -> None:
        with self._lock:
            self._records.pop(name, None)

    def get(self, name: str) -> IAgent:
        with self._lock:
            record = self._records.get(name)
        if record is None:
            raise AgentRegistryError(f"Agent not found: '{name}'")
        return record.agent

    def get_record(self, name: str) -> AgentRecord:
        with self._lock:
            record = self._records.get(name)
        if record is None:
            raise AgentRegistryError(f"Agent not found: '{name}'")
        return record

    def exists(self, name: str) -> bool:
        with self._lock:
            return name in self._records

    def list_agents(self) -> list[str]:
        with self._lock:
            return list(self._records.keys())

    def list_records(self) -> list[AgentRecord]:
        with self._lock:
            return list(self._records.values())

    def clear(self) -> None:
        with self._lock:
            self._records.clear()

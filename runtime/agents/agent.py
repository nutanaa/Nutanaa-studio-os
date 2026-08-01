from __future__ import annotations

import inspect
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

from runtime.agents.agent_state import AgentState
from runtime.agents.agent_types import AgentStatus
from runtime.contracts.i_agent import IAgent

InitializeHook = Callable[[], Any | Awaitable[Any]]
ExecuteHook = Callable[[Any], Any | Awaitable[Any]]
VoidHook = Callable[[], Any | Awaitable[Any]]
StatusHook = Callable[[], str | Awaitable[str]]


@dataclass(slots=True)
class CallableAgent(IAgent):
    """Agent implementation backed by callables."""

    name: str
    initialize_hook: InitializeHook | None = None
    execute_hook: ExecuteHook | None = None
    validate_hook: VoidHook | None = None
    cancel_hook: VoidHook | None = None
    pause_hook: VoidHook | None = None
    resume_hook: VoidHook | None = None
    status_hook: StatusHook | None = None
    shutdown_hook: VoidHook | None = None
    state: AgentState = field(init=False)

    def __post_init__(self) -> None:
        self.state = AgentState(agent_name=self.name, status=AgentStatus.IDLE)

    async def initialize(self) -> None:
        self.state.status = AgentStatus.INITIALISING
        self.state.touch()
        if self.initialize_hook is not None:
            result = self.initialize_hook()
            if inspect.isawaitable(result):
                await result
        self.state.status = AgentStatus.READY
        self.state.touch()

    async def execute(self, input_data: Any) -> Any:
        self.state.status = AgentStatus.RUNNING
        self.state.last_input = input_data
        self.state.touch()
        if self.execute_hook is None:
            result = input_data
        else:
            result = self.execute_hook(input_data)
            if inspect.isawaitable(result):
                result = await result
        self.state.last_output = result
        self.state.status = AgentStatus.COMPLETED
        self.state.touch()
        return result

    async def validate(self) -> None:
        if self.validate_hook is not None:
            result = self.validate_hook()
            if inspect.isawaitable(result):
                await result

    async def cancel(self) -> None:
        self.state.status = AgentStatus.CANCELLED
        self.state.touch()
        if self.cancel_hook is not None:
            result = self.cancel_hook()
            if inspect.isawaitable(result):
                await result

    async def pause(self) -> None:
        self.state.status = AgentStatus.PAUSED
        self.state.touch()
        if self.pause_hook is not None:
            result = self.pause_hook()
            if inspect.isawaitable(result):
                await result

    async def resume(self) -> None:
        self.state.status = AgentStatus.RUNNING
        self.state.touch()
        if self.resume_hook is not None:
            result = self.resume_hook()
            if inspect.isawaitable(result):
                await result

    async def status(self) -> str:
        if self.status_hook is None:
            return self.state.status.value
        result = self.status_hook()
        if inspect.isawaitable(result):
            result = await result
        return str(result)

    async def shutdown(self) -> None:
        self.state.status = AgentStatus.IDLE
        self.state.touch()
        if self.shutdown_hook is not None:
            result = self.shutdown_hook()
            if inspect.isawaitable(result):
                await result

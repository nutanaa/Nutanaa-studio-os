"""
Nutanaa Backend API — FastAPI bridge between clients (the editor today;
web and mobile later) and the Python runtime core (`runtime/`).

This wraps the real `runtime.bootstrap.bootstrap()` — the exact same
entry point a CLI or test harness would use — and exposes it over
HTTP + WebSocket. It does not simulate anything: `/health` reports the
runtime's real `RuntimeHealth` flags, `/agents` reflects whatever is
actually registered in `AgentManager` (empty until something registers
one), `/providers` reflects whatever is actually registered in
`ProviderManager` (currently just Ollama, honestly reported as
unhealthy if no local Ollama server is running), and `/ws` forwards
real events from the runtime's own `EventBus`.

Run locally from the repo root, so `runtime` and `backend` are both
importable:

    pip install -r requirements/base.txt
    uvicorn backend.api.main:app --host 127.0.0.1 --port 8787 --reload

The editor-side client is
`editor/src/vs/workbench/contrib/nutanaa/browser/nutanaaRuntimeConnectionService.ts`,
which expects exactly this host and port — see `NUTANAA_RUNTIME_HTTP_URL`
and `NUTANAA_RUNTIME_WS_URL` in `common/nutanaa.ts`.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from runtime.agents.agent import CallableAgent
from runtime.bootstrap import bootstrap
from runtime.events.event_bus import Event
from runtime.providers.ollama_provider import OllamaProvider
from runtime.runtime_context import RuntimeContext

logger = logging.getLogger(__name__)

_context: RuntimeContext | None = None


def get_context() -> RuntimeContext:
	"""Return the bootstrapped runtime context.

	Raises if called before the app's lifespan startup has run — that
	should never happen in practice since FastAPI won't serve requests
	until `lifespan` has yielded.
	"""
	if _context is None:
		raise RuntimeError("Runtime context not initialized — startup hasn't run yet.")
	return _context


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
	"""Bootstrap the runtime, register the providers this API instance
	wants available, then start it — and shut everything down cleanly on
	exit.

	Registering providers here (rather than inside `bootstrap()` itself)
	keeps `runtime/` provider-agnostic: a CLI or a test harness can
	bootstrap the same runtime core and register a different set of
	providers (or none at all, or the MockProvider) without touching
	this file.
	"""
	global _context
	_context = bootstrap()

	_context.provider_manager.register("ollama", OllamaProvider())
	_context.provider_manager.set_default("ollama")

	async def _chat_execute(input_data: Any) -> str:
		"""Backs the 'chat-assistant' agent: routes whatever it's given to
		the default provider's chat() and returns the real text response.
		No canned replies — if no provider is healthy, this raises, and
		AgentManager.execute() surfaces that as a real failure rather
		than a fake success."""
		prompt = input_data if isinstance(input_data, str) else str(input_data)
		assert _context is not None
		response = await _context.provider_manager.chat(prompt)
		return response.text

	chat_agent = CallableAgent(name="chat-assistant", execute_hook=_chat_execute)
	_context.agent_manager.register("chat-assistant", chat_agent)

	assert _context.lifecycle is not None, "bootstrap() did not attach a lifecycle"
	await _context.lifecycle.startup()
	logger.info("Nutanaa runtime started; API ready.")
	try:
		yield
	finally:
		await _context.lifecycle.shutdown()
		logger.info("Nutanaa runtime shut down.")


app = FastAPI(title="Nutanaa Backend API", lifespan=lifespan)

# The editor may run as a web workbench (browser) as well as Electron;
# CORS needs to be open for local dev across both. Tighten this once the
# editor and this API are packaged/deployed together.
app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
	"""Liveness/readiness probe — this is what the editor's `connect()`
	checks before it even attempts the WebSocket."""
	context = get_context()
	return {
		"status": "ok" if context.health.healthy else "degraded",
		"uptimeSeconds": round(context.metrics.uptime_seconds(), 1),
		"providers": context.health.providers,
		"plugins": context.health.plugins,
		"agents": context.health.agents,
		"workflows": context.health.workflows,
	}


@app.get("/agents")
async def list_agents() -> list[dict]:
	"""Real agent list from `AgentManager` — includes the 'chat-assistant'
	agent registered at startup, with its real, currently-tracked status.
	No synthesized data, matching the editor's own `getAgents()` contract
	in `common/nutanaa.ts`."""
	context = get_context()
	statuses = context.agent_manager.statuses()
	return [
		{"id": name, "name": name, "role": "agent", "status": statuses.get(name, "idle")}
		for name in context.agent_manager.list_agents()
	]


@app.post("/agents/{name}/execute")
async def execute_agent(name: str, payload: dict) -> dict:
	"""Execute a registered agent with a plain input payload, e.g.
	{"input": "hello"}. Returns the agent's real output, or a real error
	if the agent doesn't exist or execution fails (e.g. no healthy
	provider) — never a canned response."""
	context = get_context()
	try:
		result = await context.agent_manager.execute(name, payload.get("input", ""))
	except Exception as exc:  # noqa: BLE001 - surfaced to the caller, not swallowed
		return {"success": False, "error": str(exc)}
	return {"success": True, "output": result}


@app.get("/providers")
async def list_providers() -> list[dict]:
	"""Real provider list from `ProviderManager`, including each
	provider's actual, currently-measured health — not a static
	"Disconnected"/"Not Configured" placeholder."""
	context = get_context()
	return [
		{
			"id": record.name,
			"name": record.metadata.name,
			"type": record.metadata.provider_type.value,
			"healthy": record.health.healthy,
			"status": record.health.status.value,
			"message": record.health.message,
			"models": list(record.metadata.models),
			"activeModel": getattr(record.provider, "active_model", None),
		}
		for record in context.provider_manager.list_records()
	]


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket) -> None:
	"""Held-open connection that forwards every real runtime event — agent
	lifecycle, workflow progress, provider health changes, whatever gets
	published to the runtime's `EventBus` — to the connected client as it
	happens.
	"""
	await websocket.accept()
	context = get_context()

	async def forward(event: Event) -> None:
		try:
			await websocket.send_json({
				"type": event.type,
				"source": event.source,
				"subjectId": event.subject_id,
				"payload": event.payload,
			})
		except Exception:  # noqa: BLE001 - client may already be gone
			pass

	context.event_bus.subscribe("*", forward)
	try:
		while True:
			await websocket.receive_text()
	except WebSocketDisconnect:
		pass
	finally:
		context.event_bus.unsubscribe("*", forward)
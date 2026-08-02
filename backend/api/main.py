"""
Nutanaa Backend API — FastAPI bridge between clients (the editor today;
web and mobile later) and the Python runtime core (`runtime/`).

This wraps the real `runtime.bootstrap.bootstrap()` — the exact same
entry point a CLI or test harness would use — and exposes it over
HTTP + WebSocket. It does not simulate anything: `/health` reports the
runtime's real `RuntimeHealth` flags, `/agents` reflects whatever is
actually registered in `AgentManager` (empty until something registers
one), and `/ws` forwards real events from the runtime's own `EventBus`.

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

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from runtime.bootstrap import bootstrap
from runtime.events.event_bus import Event
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
	"""Bootstrap and start the runtime once, when the API process starts,
	and shut it down cleanly on exit.

	This mirrors exactly how any other embedder of `runtime/` (a CLI, a
	test harness) is expected to use `bootstrap()` plus the
	`RuntimeLifecycle` facade it returns — the API layer isn't special,
	it's just one more consumer of the same contract.
	"""
	global _context
	_context = bootstrap()
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
	"""Real agent list from `AgentManager` — empty until something actually
	registers an agent. No synthesized data, matching the editor's own
	`getAgents()` contract in `common/nutanaa.ts`."""
	context = get_context()
	statuses = context.agent_manager.statuses()
	return [
		{"id": name, "name": name, "role": "agent", "status": statuses.get(name, "idle")}
		for name in context.agent_manager.list_agents()
	]


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket) -> None:
	"""Held-open connection that forwards every real runtime event — agent
	lifecycle, workflow progress, provider health changes, whatever gets
	published to the runtime's `EventBus` — to the connected client as it
	happens. No heartbeat-only placeholder anymore; this is wired to real
	events.
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
			# We don't expect inbound messages yet; reading keeps this
			# coroutine responsive to a client-initiated close.
			await websocket.receive_text()
	except WebSocketDisconnect:
		pass
	finally:
		context.event_bus.unsubscribe("*", forward)
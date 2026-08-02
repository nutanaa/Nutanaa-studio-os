"""
Provider implementation talking to a local Ollama server
(https://ollama.com) over its HTTP API.

This is the first non-mock provider in the runtime — it proves the full
IProvider contract end to end against something real, instead of the
deterministic MockProvider used in tests.

Requires a running Ollama instance (default http://127.0.0.1:11434) with
at least one model pulled, e.g.:

    ollama pull llama3.2

No API key needed — Ollama runs entirely locally. If Ollama isn't
running, this provider still registers and initializes without raising —
it just reports itself unhealthy, consistent with how the rest of the
runtime treats "not available" as a real, honestly-reported state rather
than a startup failure.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

import httpx

logger = logging.getLogger(__name__)

from runtime.providers.base_provider import BaseProvider
from runtime.providers.provider_capability import ProviderCapability
from runtime.providers.provider_exceptions import ProviderConfigurationError
from runtime.providers.provider_health import HealthStatus, ProviderHealth
from runtime.providers.provider_metadata import ProviderMetadata
from runtime.providers.provider_response import ProviderResponse
from runtime.providers.provider_type import ProviderType

DEFAULT_BASE_URL = "http://127.0.0.1:11434"
DEFAULT_MODEL = "llama3.2"


class OllamaProvider(BaseProvider):
	"""Provider backed by a local Ollama server."""

	def __init__(
		self,
		*,
		base_url: str = DEFAULT_BASE_URL,
		model: str = DEFAULT_MODEL,
	) -> None:
		super().__init__(
			ProviderMetadata(
				provider_id="ollama",
				name="Ollama (local)",
				provider_type=ProviderType.OLLAMA,
				version="0.1.0",
				capabilities=frozenset({
					ProviderCapability.TEXT,
					ProviderCapability.STREAM,
					ProviderCapability.EMBEDDING,
				}),
				models=(model,),
				supports_streaming=True,
				description=f"Local Ollama server at {base_url}",
			)
		)
		self._base_url = base_url.rstrip("/")
		self._model = model
		self._client: httpx.AsyncClient | None = None
		self._health = ProviderHealth(status=HealthStatus.UNKNOWN)

	async def initialize(self) -> None:
		await super().initialize()
		self._client = httpx.AsyncClient(base_url=self._base_url, timeout=30.0)
		if not await self.health_check():
			self._health.mark(
				HealthStatus.UNHEALTHY,
				message=(
					f"Could not reach Ollama at {self._base_url}. "
					"Is it running? (`ollama serve`)"
				),
			)
			return
		await self._resolve_model()

	async def _resolve_model(self) -> None:
		"""Pick a usable model.

		Keeps the configured default (`self._model`) if it's actually
		installed. Otherwise falls back to whatever Ollama does have
		pulled, rather than leaving every later chat()/stream()/
		embeddings() call to fail against a model that was never there.
		If nothing is pulled at all, reports that honestly via health
		instead of guessing.
		"""
		assert self._client is not None
		try:
			response = await self._client.get("/api/tags")
			response.raise_for_status()
			data = response.json()
			installed = [
				model.get("name", "")
				for model in data.get("models", [])
				if model.get("name")
			]
		except (httpx.HTTPError, OSError) as exc:
			self._health.mark(
				HealthStatus.DEGRADED,
				message=f"Ollama reachable, but could not list installed models: {exc}",
			)
			return

		if not installed:
			self._health.mark(
				HealthStatus.DEGRADED,
				message="Ollama is running but has no models pulled. Run `ollama pull <model>`.",
			)
			return

		if self._model not in installed:
			fallback = installed[0]
			logger.warning(
				"Configured default model '%s' is not installed; falling back to '%s'. "
				"Installed models: %s",
				self._model,
				fallback,
				installed,
			)
			self._model = fallback

		self._metadata.models = tuple(installed)
		self._health.mark(
			HealthStatus.HEALTHY,
			message=f"Ollama reachable; using model '{self._model}'",
			details={"installedModels": installed, "activeModel": self._model},
		)

	async def shutdown(self) -> None:
		await super().shutdown()
		if self._client is not None:
			await self._client.aclose()
			self._client = None
		self._health.mark(HealthStatus.UNKNOWN, message="provider stopped")

	async def health(self) -> ProviderHealth:
		return self._health

	@property
	def active_model(self) -> str:
		"""The model actually in use — may differ from the configured
		default if it wasn't installed and `_resolve_model()` fell back
		to whatever was available."""
		return self._model

	async def health_check(self) -> bool:
		if self._client is None:
			return False
		try:
			response = await self._client.get("/api/tags")
			response.raise_for_status()
			self._health.mark(HealthStatus.HEALTHY, message="Ollama reachable")
			return True
		except (httpx.HTTPError, OSError) as exc:
			self._health.mark(HealthStatus.UNHEALTHY, message=str(exc))
			return False

	async def chat(self, prompt: str, **kwargs: Any) -> ProviderResponse:
		self._require_client()
		model = kwargs.get("model", self._model)
		assert self._client is not None
		response = await self._client.post(
			"/api/chat",
			json={
				"model": model,
				"messages": [{"role": "user", "content": prompt}],
				"stream": False,
			},
		)
		response.raise_for_status()
		data = response.json()
		text = data.get("message", {}).get("content", "")
		return ProviderResponse.ok(
			request_id=kwargs.get("request_id", "ollama-request"),
			provider_id=self.provider_id,
			capability=ProviderCapability.TEXT,
			result=text,
			usage={
				"promptEvalCount": data.get("prompt_eval_count"),
				"evalCount": data.get("eval_count"),
			},
			model=model,
		)

	async def stream(self, prompt: str, **kwargs: Any) -> AsyncIterator[str]:
		self._require_client()
		model = kwargs.get("model", self._model)
		assert self._client is not None
		async with self._client.stream(
			"POST",
			"/api/chat",
			json={
				"model": model,
				"messages": [{"role": "user", "content": prompt}],
				"stream": True,
			},
		) as response:
			response.raise_for_status()
			async for line in response.aiter_lines():
				if not line:
					continue
				chunk = json.loads(line)
				content = chunk.get("message", {}).get("content", "")
				if content:
					yield content
				if chunk.get("done"):
					break

	async def embeddings(self, text: str, **kwargs: Any) -> list[float]:
		self._require_client()
		model = kwargs.get("model", self._model)
		assert self._client is not None
		response = await self._client.post(
			"/api/embeddings",
			json={"model": model, "prompt": text},
		)
		response.raise_for_status()
		data = response.json()
		return [float(value) for value in data.get("embedding", [])]

	def validate_configuration(self) -> None:
		super().validate_configuration()
		if not self._base_url:
			raise ProviderConfigurationError(self.provider_id, "base_url must not be blank")

	def _require_client(self) -> None:
		if self._client is None:
			raise ProviderConfigurationError(
				self.provider_id,
				"provider not initialized — call initialize() first",
			)
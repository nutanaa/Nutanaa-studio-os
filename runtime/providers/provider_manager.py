from __future__ import annotations

import inspect
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from time import perf_counter
from typing import Any

from runtime.contracts.i_provider import IProvider
from runtime.exceptions.provider_exception import (
    ProviderInitError,
    ProviderNotFoundError,
)
from runtime.providers.provider_cache import ProviderCache
from runtime.providers.provider_capability import ProviderCapability
from runtime.providers.provider_exceptions import (
    ProviderCapabilityError,
    ProviderConfigurationError,
    ProviderRateLimitError,
    ProviderRetryExhaustedError,
    ProviderRoutingError,
    ProviderSelectionError,
)
from runtime.providers.provider_health import HealthStatus
from runtime.providers.provider_metadata import ProviderMetadata
from runtime.providers.provider_registry import ProviderRecord, ProviderRegistry
from runtime.providers.provider_request import ProviderRequest
from runtime.providers.provider_response import ProviderResponse
from runtime.providers.provider_retry import RetryPolicy
from runtime.providers.provider_session import ProviderSession

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class ProviderSelection:
    """Provider selected for a request."""

    name: str
    record: ProviderRecord


class ProviderManager:
    """Manage provider registration, discovery, routing, and lifecycle."""

    def __init__(
        self,
        registry: ProviderRegistry | None = None,
        default_provider: str = "",
    ) -> None:
        self._registry = registry or ProviderRegistry()
        self._default_provider = default_provider
        self._cache = ProviderCache()

    @property
    def default_provider(self) -> str:
        """Return the current default provider name."""
        return self._default_provider

    def register(
        self,
        name: str,
        provider: IProvider,
        metadata: ProviderMetadata | None = None,
    ) -> ProviderRecord:
        """Register a provider instance."""
        try:
            provider.validate_configuration()
        except Exception as exc:  # pragma: no cover - defensive
            raise ProviderConfigurationError(
                name,
                str(exc),
            ) from exc
        record = self._registry.register_provider(name, provider, metadata=metadata)
        logger.info("Registered provider: '%s'", name)
        return record

    register_provider = register

    def unregister(self, name: str) -> None:
        self._registry.unregister_provider(name)
        logger.info("Unregistered provider: '%s'", name)

    unregister_provider = unregister

    def get(self, name: str) -> IProvider:
        provider = self._registry.get_provider(name)
        if provider is None:
            raise ProviderNotFoundError(name)
        return provider

    def get_record(self, name: str) -> ProviderRecord:
        record = self._registry.get_record(name)
        if record is None:
            raise ProviderNotFoundError(name)
        return record

    def get_default(self) -> IProvider:
        if not self._default_provider:
            raise ProviderNotFoundError("<default>")
        return self.get(self._default_provider)

    get_default_provider = get_default

    def set_default(self, name: str) -> None:
        if not self._registry.provider_exists(name):
            raise ProviderNotFoundError(name)
        self._default_provider = name
        logger.info("Default provider set to: '%s'", name)

    def list_providers(self) -> list[str]:
        return self._registry.list_providers()

    def list_records(self) -> list[ProviderRecord]:
        return self._registry.list_records()

    def find_by_capability(
        self,
        capability: ProviderCapability | str,
    ) -> list[ProviderRecord]:
        return self._registry.find_by_capability(capability)

    def select_provider(
        self,
        capability: ProviderCapability | str,
        preferred: str | None = None,
    ) -> ProviderSelection:
        record = self._registry.select_best(capability, preferred=preferred)
        if record is None:
            raise ProviderSelectionError(getattr(capability, "value", str(capability)))
        return ProviderSelection(name=record.name, record=record)

    async def initialize(self, name: str) -> None:
        provider = self.get(name)
        started = perf_counter()
        try:
            await provider.initialize()
        except Exception as exc:
            record = self._registry.get_record(name)
            if record is not None:
                record.last_error = str(exc)
                record.health.mark(
                    HealthStatus.UNHEALTHY,
                    latency_ms=(perf_counter() - started) * 1000,
                    message=str(exc),
                )
            raise ProviderInitError(name, str(exc)) from exc
        record = self._registry.get_record(name)
        if record is not None:
            record.initialized = True
            record.session = ProviderSession(provider_id=record.metadata.provider_id)
            record.health.mark(
                HealthStatus.HEALTHY,
                latency_ms=(perf_counter() - started) * 1000,
                message="initialized",
            )
        logger.info("Initialised provider: '%s'", name)

    async def initialize_all(self) -> None:
        for name in self.list_providers():
            await self.initialize(name)

    async def shutdown(self, name: str) -> None:
        provider = self.get(name)
        try:
            await provider.shutdown()
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Error shutting down provider '%s': %s", name, exc)
        record = self._registry.get_record(name)
        if record is not None:
            record.initialized = False
            if record.session is not None:
                record.session.close()
            record.health.mark(HealthStatus.UNKNOWN, message="shutdown")
        logger.info("Shut down provider: '%s'", name)

    async def shutdown_all(self) -> None:
        for name in reversed(self.list_providers()):
            await self.shutdown(name)

    async def health_check(self, name: str) -> bool:
        provider = self.get(name)
        started = perf_counter()
        healthy = await provider.health_check()
        record = self._registry.get_record(name)
        if record is not None:
            record.health.mark(
                HealthStatus.HEALTHY if healthy else HealthStatus.UNHEALTHY,
                latency_ms=(perf_counter() - started) * 1000,
                message="healthy" if healthy else "unhealthy",
            )
        if not healthy:
            logger.warning("Provider '%s' health check failed", name)
        return healthy

    async def health_check_all(self) -> dict[str, bool]:
        return await self._registry.health_check_all()

    async def execute(self, request: ProviderRequest) -> ProviderResponse:
        """Execute a provider request with retry, caching, and fallback."""
        if (
            request.capability is ProviderCapability.STREAM
            or request.operation == "stream"
        ):
            raise ProviderRoutingError(
                "stream requests must use ProviderManager.stream"
            )

        selection = self.select_provider(
            request.capability,
            preferred=request.provider_name,
        )
        if request.cache_key is not None:
            cached = self._cache.get(request.cache_key)
            if isinstance(cached, ProviderResponse):
                selection.record.metrics.record_cache_hit()
                return cached
            selection.record.metrics.record_cache_miss()
        response = await self._invoke_with_fallback(selection, request)
        if request.cache_key is not None:
            self._cache.put(request.cache_key, response, request.cache_ttl_seconds)
        return response

    async def chat(
        self,
        prompt: str,
        *,
        preferred: str | None = None,
        **kwargs: Any,
    ) -> ProviderResponse:
        request = ProviderRequest(
            capability=ProviderCapability.TEXT,
            prompt=prompt,
            operation="chat",
            provider_name=preferred,
            options=dict(kwargs),
        )
        return await self.execute(request)

    async def stream(
        self,
        prompt: str,
        *,
        preferred: str | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        selection = self.select_provider(ProviderCapability.STREAM, preferred=preferred)
        provider = selection.record.provider
        handler = getattr(provider, "stream", None)
        if handler is None:
            raise ProviderRoutingError("selected provider has no stream method")
        result = handler(prompt, **kwargs)
        if inspect.isawaitable(result):
            result = await result
        if not hasattr(result, "__aiter__"):
            raise ProviderRoutingError("selected provider stream is not async iterable")
        async for chunk in result:
            yield chunk

    async def embeddings(
        self,
        text: str,
        *,
        preferred: str | None = None,
        **kwargs: Any,
    ) -> list[float]:
        request = ProviderRequest(
            capability=ProviderCapability.EMBEDDING,
            prompt=text,
            operation="embeddings",
            provider_name=preferred,
            options=dict(kwargs),
        )
        response = await self.execute(request)
        if isinstance(response.result, list):
            return [float(item) for item in response.result]
        raise ProviderRoutingError("embedding result is not a list")

    async def vision(
        self,
        prompt: str,
        *,
        preferred: str | None = None,
        **kwargs: Any,
    ) -> ProviderResponse:
        return await self._execute_simple(
            ProviderCapability.IMAGE,
            "vision",
            prompt,
            preferred=preferred,
            **kwargs,
        )

    async def audio(
        self,
        prompt: str,
        *,
        preferred: str | None = None,
        **kwargs: Any,
    ) -> ProviderResponse:
        return await self._execute_simple(
            ProviderCapability.AUDIO,
            "audio",
            prompt,
            preferred=preferred,
            **kwargs,
        )

    async def video(
        self,
        prompt: str,
        *,
        preferred: str | None = None,
        **kwargs: Any,
    ) -> ProviderResponse:
        return await self._execute_simple(
            ProviderCapability.VIDEO,
            "video",
            prompt,
            preferred=preferred,
            **kwargs,
        )

    async def tool_call(
        self,
        tool_name: str,
        *,
        preferred: str | None = None,
        **kwargs: Any,
    ) -> ProviderResponse:
        return await self._execute_simple(
            ProviderCapability.TOOL_CALL,
            "tool_call",
            tool_name,
            preferred=preferred,
            **kwargs,
        )

    async def generate(self, prompt: str, **kwargs: Any) -> str:
        response = await self.chat(prompt, **kwargs)
        return response.text

    async def generate_stream(self, prompt: str, **kwargs: Any) -> AsyncIterator[str]:
        async for chunk in self.stream(prompt, **kwargs):
            yield chunk

    async def embed(self, text: str, **kwargs: Any) -> list[float]:
        return await self.embeddings(text, **kwargs)

    async def route_request(self, request: ProviderRequest) -> ProviderResponse:
        return await self.execute(request)

    async def _execute_simple(
        self,
        capability: ProviderCapability,
        operation: str,
        prompt: str,
        *,
        preferred: str | None = None,
        **kwargs: Any,
    ) -> ProviderResponse:
        request = ProviderRequest(
            capability=capability,
            prompt=prompt,
            operation=operation,
            provider_name=preferred,
            options=dict(kwargs),
        )
        return await self.execute(request)

    async def _invoke_with_fallback(
        self,
        selection: ProviderSelection,
        request: ProviderRequest,
    ) -> ProviderResponse:
        candidates = self._candidate_records(
            request.capability,
            preferred=selection.name,
        )
        last_error: Exception | None = None
        retry_policy = RetryPolicy()
        for record in candidates:
            if not record.rate_limiter.try_acquire():
                record.metrics.record_failure()
                record.last_error = "rate limited"
                record.health.mark(
                    HealthStatus.DEGRADED,
                    message="rate limited",
                )
                last_error = ProviderRateLimitError(record.name)
                continue
            record.metrics.record_request()
            try:
                result = await self._invoke_provider(
                    record.provider,
                    request,
                    retry_policy,
                )
                response = self._coerce_response(record.name, request, result)
                record.metrics.record_success()
                record.health.mark(HealthStatus.HEALTHY, message="request succeeded")
                return response
            except ProviderCapabilityError as exc:
                last_error = exc
                record.metrics.record_failure()
                record.last_error = str(exc)
                record.health.mark(HealthStatus.UNHEALTHY, message=str(exc))
            except ProviderRoutingError as exc:
                last_error = exc
                record.metrics.record_failure()
                record.last_error = str(exc)
                record.health.mark(HealthStatus.UNHEALTHY, message=str(exc))
            except ProviderRetryExhaustedError as exc:
                last_error = exc
                record.metrics.record_retry()
                record.metrics.record_failure()
                record.last_error = str(exc)
                record.health.mark(HealthStatus.DEGRADED, message=str(exc))
            except Exception as exc:  # pragma: no cover - defensive
                last_error = exc
                record.metrics.record_failure()
                record.last_error = str(exc)
                record.health.mark(HealthStatus.UNHEALTHY, message=str(exc))
        raise ProviderRetryExhaustedError(
            str(last_error) if last_error else "request failed"
        )

    def _candidate_records(
        self,
        capability: ProviderCapability | str,
        *,
        preferred: str | None = None,
    ) -> list[ProviderRecord]:
        candidates = self._registry.find_by_capability(capability)
        if preferred is not None:
            preferred_record = self._registry.get_record(preferred)
            if preferred_record is not None:
                candidates = [preferred_record] + [
                    record
                    for record in candidates
                    if record.name != preferred_record.name
                ]
        candidates.sort(key=self._selection_key)
        return candidates

    def _selection_key(self, record: ProviderRecord) -> tuple[int, float, int]:
        healthy_rank = 0 if record.health.healthy else 1
        latency_rank = record.metrics.average_latency_ms
        failure_rank = record.metrics.failures
        return (healthy_rank, latency_rank, failure_rank)

    async def _invoke_provider(
        self,
        provider: IProvider,
        request: ProviderRequest,
        retry_policy: RetryPolicy,
    ) -> Any:
        async def _call() -> Any:
            method = request.operation or self._default_operation(request.capability)
            handler = getattr(provider, method, None)
            if handler is None:
                raise ProviderRoutingError(f"provider has no method '{method}'")
            result = handler(request.prompt, **request.options)
            if inspect.isawaitable(result):
                return await result
            return result

        return await retry_policy.execute(_call)

    def _default_operation(self, capability: ProviderCapability) -> str:
        mapping = {
            ProviderCapability.TEXT: "chat",
            ProviderCapability.STREAM: "stream",
            ProviderCapability.EMBEDDING: "embeddings",
            ProviderCapability.IMAGE: "vision",
            ProviderCapability.AUDIO: "audio",
            ProviderCapability.VIDEO: "video",
            ProviderCapability.TOOL_CALL: "tool_call",
            ProviderCapability.REASONING: "chat",
            ProviderCapability.UPSCALE: "vision",
            ProviderCapability.LIP_SYNC: "video",
            ProviderCapability.SPEECH: "audio",
        }
        return mapping.get(capability, "chat")

    def _coerce_response(
        self,
        provider_id: str,
        request: ProviderRequest,
        value: Any,
    ) -> ProviderResponse:
        if isinstance(value, ProviderResponse):
            return value
        if isinstance(value, list):
            return ProviderResponse.ok(
                request_id=request.request_id,
                provider_id=provider_id,
                capability=request.capability,
                result=value,
            )
        return ProviderResponse.ok(
            request_id=request.request_id,
            provider_id=provider_id,
            capability=request.capability,
            result=value,
        )

    async def start(self) -> None:
        """Compatibility alias for initialize_all."""
        await self.initialize_all()

    async def stop(self) -> None:
        """Compatibility alias for shutdown_all."""
        await self.shutdown_all()

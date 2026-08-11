/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { ITrace, ITraceSpan, ITraceEvent, ITraceQuery } from '../../models/productionModel.js';
import { ITracingManager } from '../../common/ops/tracingManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../../common/runtime/runtimeEventBus.js';

/**
 * TracingManager implementation for Nutanaa Studio OS Production.
 *
 * Provides distributed tracing for requests, workflows, agents, and providers.
 */
export class TracingManager extends Disposable implements ITracingManager {

	declare readonly _serviceBrand: undefined;

	private traces = new Map<string, ITrace>();
	private spans = new Map<string, ITraceSpan>();
	private correlationContext = new Map<string, Record<string, unknown>>();
	private currentTraceContext = new Map<string, string>(); // contextId -> traceId

	private readonly _onDidCreateTrace = this._register(new Emitter<ITrace>());
	private readonly _onDidCompleteSpan = this._register(new Emitter<{ traceId: string; span: ITraceSpan }>());

	public readonly onDidCreateTrace = this._onDidCreateTrace.event;
	public readonly onDidCompleteSpan = this._onDidCompleteSpan.event;

	private readonly MAX_TRACES = 1000;

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.loadTraces();
	}

	// ── Traces ───────────────────────────────────────────────────────────────

	startTrace(type: 'request' | 'workflow' | 'agent' | 'provider' | 'tool', name: string, attributes?: Record<string, unknown>): string {
		const traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const rootSpan: ITraceSpan = {
			id: `span-${Date.now()}-root`,
			traceId,
			parentId: undefined,
			name,
			type,
			startTime: Date.now(),
			endTime: 0,
			duration: 0,
			status: 'ok',
			attributes: attributes || {},
			events: [],
			children: [],
		};

		const trace: ITrace = {
			id: traceId,
			type,
			rootSpan,
			spans: [rootSpan],
			startTime: Date.now(),
			endTime: 0,
			status: 'ok',
			correlationId: this.generateCorrelationId(),
		};

		this.traces.set(traceId, trace);
		this.spans.set(rootSpan.id, rootSpan);

		this._onDidCreateTrace.fire(trace);
		this.logService.debug(`Trace started: ${traceId} (${name})`);

		return traceId;
	}

	endTrace(traceId: string, status: 'ok' | 'error' | 'cancelled'): void {
		const trace = this.traces.get(traceId);
		if (!trace) {
			return;
		}

		const now = Date.now();
		trace.endTime = now;
		trace.status = status;

		// Update root span
		const rootSpan = trace.rootSpan;
		rootSpan.endTime = now;
		rootSpan.duration = now - rootSpan.startTime;
		rootSpan.status = status;

		// Calculate total duration from children
		let totalDuration = rootSpan.duration;
		for (const span of trace.spans) {
			if (span.id !== rootSpan.id) {
				totalDuration = Math.max(totalDuration, span.startTime + span.duration - rootSpan.startTime);
			}
		}

		this.traces.set(traceId, trace);

		// Fire event
		this.runtimeEventBus.fire({
			type: RuntimeEventType.TraceStarted,
			timestamp: Date.now(),
			payload: {
				traceId,
				type: trace.type,
				spanCount: trace.spans.length,
				duration: totalDuration,
			},
		});

		this.logService.debug(`Trace ended: ${traceId} (${status})`);
		this.saveTraces();
	}

	getTrace(traceId: string): ITrace | undefined {
		return this.traces.get(traceId);
	}

	getCurrentTrace(contextId: string): ITrace | undefined {
		const traceId = this.currentTraceContext.get(contextId);
		if (!traceId) {
			return undefined;
		}
		return this.traces.get(traceId);
	}

	getAllTraces(): ITrace[] {
		return Array.from(this.traces.values());
	}

	// ── Spans ───────────────────────────────────────────────────────────────

	startSpan(
		traceId: string,
		parentId: string | undefined,
		name: string,
		type: 'request' | 'workflow' | 'agent' | 'provider' | 'tool' | 'internal',
		attributes?: Record<string, unknown>
	): string {
		const trace = this.traces.get(traceId);
		if (!trace) {
			throw new Error(`Trace ${traceId} not found`);
		}

		const spanId = `span-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const span: ITraceSpan = {
			id: spanId,
			traceId,
			parentId,
			name,
			type,
			startTime: Date.now(),
			endTime: 0,
			duration: 0,
			status: 'ok',
			attributes: attributes || {},
			events: [],
			children: [],
		};

		this.spans.set(spanId, span);
		trace.spans.push(span);
		this.traces.set(traceId, trace);

		// Add to parent's children
		if (parentId) {
			const parent = this.spans.get(parentId);
			if (parent) {
				parent.children.push(span);
				this.spans.set(parentId, parent);
			}
		}

		return spanId;
	}

	endSpan(spanId: string, status: 'ok' | 'error' | 'cancelled', attributes?: Record<string, unknown>): void {
		const span = this.spans.get(spanId);
		if (!span) {
			return;
		}

		const now = Date.now();
		span.endTime = now;
		span.duration = now - span.startTime;
		span.status = status;

		if (attributes) {
			span.attributes = { ...span.attributes, ...attributes };
		}

		this.spans.set(spanId, span);

		// Update trace
		const trace = this.traces.get(span.traceId);
		if (trace) {
			this.traces.set(span.traceId, trace);
		}

		this._onDidCompleteSpan.fire({ traceId: span.traceId, span });
		this.saveTraces();
	}

	addSpanEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void {
		const span = this.spans.get(spanId);
		if (!span) {
			return;
		}

		const event: ITraceEvent = {
			name,
			timestamp: Date.now(),
			attributes: attributes || {},
		};

		span.events.push(event);
		this.spans.set(spanId, span);
	}

	getSpan(spanId: string): ITraceSpan | undefined {
		return this.spans.get(spanId);
	}

	// ── Correlation ─────────────────────────────────────────────────────────

	generateCorrelationId(): string {
		return `corr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	}

	setCorrelationContext(correlationId: string, context: Record<string, unknown>): void {
		this.correlationContext.set(correlationId, context);
	}

	getCorrelationContext(correlationId: string): Record<string, unknown> | undefined {
		return this.correlationContext.get(correlationId);
	}

	// ── Query ─────────────────────────────────────────────────────────────────

	query(query: ITraceQuery): ITrace[] {
		let results = Array.from(this.traces.values());

		if (query.startTime) {
			results = results.filter(t => t.startTime >= query.startTime!);
		}
		if (query.endTime) {
			results = results.filter(t => t.startTime <= query.endTime!);
		}
		if (query.type) {
			results = results.filter(t => t.type === query.type);
		}
		if (query.traceId) {
			results = results.filter(t => t.id === query.traceId);
		}
		if (query.correlationId) {
			results = results.filter(t => t.correlationId === query.correlationId);
		}
		if (query.status) {
			results = results.filter(t => t.status === query.status);
		}

		if (query.limit) {
			results = results.slice(0, query.limit);
		}

		return results;
	}

	getTracesByCorrelation(correlationId: string): ITrace[] {
		return Array.from(this.traces.values()).filter(t => t.correlationId === correlationId);
	}

	getRecentTraces(limit = 50): ITrace[] {
		return Array.from(this.traces.values())
			.sort((a, b) => b.startTime - a.startTime)
			.slice(0, limit);
	}

	// ── Export ───────────────────────────────────────────────────────────────

	exportToJson(query?: ITraceQuery): string {
		const traces = query ? this.query(query) : Array.from(this.traces.values());
		return JSON.stringify({
			exportDate: Date.now(),
			traces,
		}, null, 2);
	}

	clearTraces(before?: number): number {
		const threshold = before || Date.now() - (7 * 24 * 60 * 60 * 1000); // Default 7 days
		const toClear: string[] = [];

		for (const [traceId, trace] of this.traces) {
			if (trace.startTime < threshold) {
				toClear.push(traceId);
				for (const span of trace.spans) {
					this.spans.delete(span.id);
				}
			}
		}

		for (const traceId of toClear) {
			this.traces.delete(traceId);
		}

		if (toClear.length > 0) {
			this.logService.info(`Cleared ${toClear.length} traces`);
			this.saveTraces();
		}

		return toClear.length;
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private loadTraces(): void {
		const stored = this.storageService.get('nutanaa.traces', 0);
		if (stored) {
			try {
				const data = JSON.parse(stored);
				for (const trace of data.traces || []) {
					this.traces.set(trace.id, trace);
					for (const span of trace.spans || []) {
						this.spans.set(span.id, span);
					}
				}
			} catch {
				this.traces = new Map();
				this.spans = new Map();
			}
		}
	}

	private saveTraces(): void {
		// Limit traces
		const tracesArray = Array.from(this.traces.values());
		if (tracesArray.length > this.MAX_TRACES) {
			tracesArray.sort((a, b) => b.startTime - a.startTime);
			const toKeep = tracesArray.slice(0, this.MAX_TRACES);
			this.traces = new Map(toKeep.map(t => [t.id, t]));
		}

		const tracesObj: Record<string, ITrace> = {};
		for (const [id, trace] of this.traces) {
			tracesObj[id] = trace;
		}

		this.storageService.store('nutanaa.traces', JSON.stringify({
			traces: tracesObj,
			savedAt: Date.now(),
		}), StorageScope.APPLICATION, StorageTarget.MACHINE);
	}
}
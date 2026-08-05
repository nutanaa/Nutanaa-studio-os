/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ITrace, ITraceSpan, ITraceEvent, ITraceQuery } from '../models/productionModel.js';

/**
 * Service for distributed tracing in Nutanaa Studio OS Production.
 *
 * Responsibilities:
 * - Request tracing
 * - Workflow tracing
 * - Agent tracing
 * - Provider tracing
 * - Correlation IDs
 * - Execution graph generation
 */
export const ITracingManager = createDecorator<ITracingManager>('nutanaaTracingManager');

export interface ITracingManager {

	// ── Traces ───────────────────────────────────────────────────────────────

	/**
	 * Start a new trace.
	 * @param type Trace type
	 * @param name Trace name
	 * @param attributes Initial attributes
	 * @returns Trace ID
	 */
	startTrace(type: 'request' | 'workflow' | 'agent' | 'provider' | 'tool', name: string, attributes?: Record<string, unknown>): string;

	/**
	 * End a trace.
	 * @param traceId Trace ID
	 * @param status Trace status
	 */
	endTrace(traceId: string, status: 'ok' | 'error' | 'cancelled'): void;

	/**
	 * Get trace by ID.
	 * @param traceId Trace ID
	 * @returns Trace or undefined
	 */
	getTrace(traceId: string): ITrace | undefined;

	/**
	 * Get current trace for a context.
	 * @param contextId Context ID (session, request, etc.)
	 * @returns Trace or undefined
	 */
	getCurrentTrace(contextId: string): ITrace | undefined;

	/**
	 * Get all traces.
	 * @returns All traces
	 */
	getAllTraces(): ITrace[];

	// ── Spans ───────────────────────────────────────────────────────────────

	/**
	 * Start a span within a trace.
	 * @param traceId Trace ID
	 * @param parentId Parent span ID (optional)
	 * @param name Span name
	 * @param type Span type
	 * @param attributes Attributes
	 * @returns Span ID
	 */
	startSpan(
		traceId: string,
		parentId: string | undefined,
		name: string,
		type: 'request' | 'workflow' | 'agent' | 'provider' | 'tool' | 'internal',
		attributes?: Record<string, unknown>
	): string;

	/**
	 * End a span.
	 * @param spanId Span ID
	 * @param status Span status
	 * @param attributes Final attributes
	 */
	endSpan(spanId: string, status: 'ok' | 'error' | 'cancelled', attributes?: Record<string, unknown>): void;

	/**
	 * Add an event to a span.
	 * @param spanId Span ID
	 * @param name Event name
	 * @param attributes Event attributes
	 */
	addSpanEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void;

	/**
	 * Get span by ID.
	 * @param spanId Span ID
	 * @returns Span or undefined
	 */
	getSpan(spanId: string): ITraceSpan | undefined;

	// ── Correlation ─────────────────────────────────────────────────────────

	/**
	 * Generate a correlation ID.
	 * @returns Correlation ID
	 */
	generateCorrelationId(): string;

	/**
	 * Set correlation context.
	 * @param correlationId Correlation ID
	 * @param context Context data
	 */
	setCorrelationContext(correlationId: string, context: Record<string, unknown>): void;

	/**
	 * Get correlation context.
	 * @param correlationId Correlation ID
	 * @returns Context data
	 */
	getCorrelationContext(correlationId: string): Record<string, unknown> | undefined;

	// ── Query ─────────────────────────────────────────────────────────────────

	/**
	 * Query traces.
	 * @param query Query parameters
	 * @returns Matching traces
	 */
	query(query: ITraceQuery): ITrace[];

	/**
	 * Get traces by correlation ID.
	 * @param correlationId Correlation ID
	 * @returns Traces
	 */
	getTracesByCorrelation(correlationId: string): ITrace[];

	/**
	 * Get recent traces.
	 * @param limit Maximum traces
	 * @returns Recent traces
	 */
	getRecentTraces(limit?: number): ITrace[];

	// ── Export ───────────────────────────────────────────────────────────────

	/**
	 * Export traces to JSON.
	 * @param query Query parameters
	 * @returns JSON string
	 */
	exportToJson(query?: ITraceQuery): string;

	/**
	 * Clear traces.
	 * @param before Clear traces before this time
	 * @returns Number of traces cleared
	 */
	clearTraces(before?: number): number;

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when a trace is created.
	 */
	onDidCreateTrace: (listener: (trace: ITrace) => void) => { dispose(): void };

	/**
	 * Event fired when a span is completed.
	 */
	onDidCompleteSpan: (listener: (traceId: string, span: ITraceSpan) => void) => { dispose(): void };
}
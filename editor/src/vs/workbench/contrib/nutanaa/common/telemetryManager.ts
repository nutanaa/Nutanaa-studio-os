/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { TelemetryLevel, ITelemetryEvent, ITelemetryConfig, ITelemetrySummary } from '../models/productionModel.js';

/**
 * Service for managing telemetry in Nutanaa Studio OS Production.
 *
 * Responsibilities:
 * - Usage telemetry collection
 * - Anonymous analytics
 * - Feature usage tracking
 * - Performance events
 * - Session tracking
 * - Configurable telemetry with user opt-in/opt-out
 */
export const ITelemetryManager = createDecorator<ITelemetryManager>('nutanaaTelemetryManager');

export interface ITelemetryManager {

	// ── Configuration ────────────────────────────────────────────────────────

	/**
	 * Get current telemetry configuration.
	 * @returns Current config
	 */
	getConfig(): ITelemetryConfig;

	/**
	 * Update telemetry level.
	 * @param level New telemetry level
	 */
	setLevel(level: TelemetryLevel): void;

	/**
	 * Set user consent for telemetry.
	 * @param consent Whether user consents
	 */
	setUserConsent(consent: boolean): void;

	/**
	 * Enable or disable a specific event.
	 * @param eventName Event name
	 * @param enabled Whether enabled
	 */
	setEventEnabled(eventName: string, enabled: boolean): void;

	/**
	 * Get current telemetry level.
	 * @returns Current level
	 */
	getLevel(): TelemetryLevel;

	/**
	 * Check if telemetry is enabled.
	 * @returns True if enabled
	 */
	isEnabled(): boolean;

	// ── Events ───────────────────────────────────────────────────────────────

	/**
	 * Log a telemetry event.
	 * @param eventName Event name
	 * @param properties Event properties
	 * @param measurements Event measurements
	 */
	logEvent(
		eventName: string,
		properties?: Record<string, unknown>,
		measurements?: Record<string, number>
	): void;

	/**
	 * Log a performance event.
	 * @param eventName Event name
	 * @param duration Duration in milliseconds
	 * @param properties Additional properties
	 */
	logPerformance(eventName: string, duration: number, properties?: Record<string, unknown>): void;

	/**
	 * Log an error event.
	 * @param eventName Event name
	 * @param error Error object or message
	 * @param properties Additional properties
	 */
	logError(eventName: string, error: unknown, properties?: Record<string, unknown>): void;

	/**
	 * Log a feature usage event.
	 * @param featureName Feature name
	 * @param properties Additional properties
	 */
	logFeatureUsage(featureName: string, properties?: Record<string, unknown>): void;

	/**
	 * Log a session event.
	 * @param eventType Event type (start, end, pause, resume)
	 */
	logSessionEvent(eventType: 'start' | 'end' | 'pause' | 'resume'): void;

	// ── Session Management ───────────────────────────────────────────────────

	/**
	 * Get current session ID.
	 * @returns Session ID
	 */
	getSessionId(): string;

	/**
	 * Start a new session.
	 * @returns New session ID
	 */
	startSession(): string;

	/**
	 * End current session.
	 */
	endSession(): void;

	/**
	 * Get session duration.
	 * @returns Duration in milliseconds
	 */
	getSessionDuration(): number;

	// ── Query ─────────────────────────────────────────────────────────────────

	/**
	 * Get telemetry summary.
	 * @param since Optional start time
	 * @returns Summary
	 */
	getSummary(since?: number): ITelemetrySummary;

	/**
	 * Get recent events.
	 * @param limit Maximum events
	 * @returns Recent events
	 */
	getRecentEvents(limit?: number): ITelemetryEvent[];

	/**
	 * Get events by name.
	 * @param eventName Event name
	 * @param limit Maximum events
	 * @returns Events
	 */
	getEventsByName(eventName: string, limit?: number): ITelemetryEvent[];

	// ── Export ───────────────────────────────────────────────────────────────

	/**
	 * Export telemetry data.
	 * @param since Start time
	 * @param until End time
	 * @returns Export data
	 */
	exportData(since?: number, until?: number): Promise<string>;

	/**
	 * Clear telemetry data.
	 * @param before Clear events before this time
	 * @returns Number of events cleared
	 */
	clearData(before?: number): number;

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when telemetry event is logged.
	 */
	onDidLogEvent: (listener: (event: ITelemetryEvent) => void) => { dispose(): void };

	/**
	 * Event fired when telemetry config changes.
	 */
	onDidChangeConfig: (listener: (config: ITelemetryConfig) => void) => { dispose(): void };
}
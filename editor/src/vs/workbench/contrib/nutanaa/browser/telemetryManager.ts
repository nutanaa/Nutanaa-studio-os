/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { TelemetryLevel, ITelemetryEvent, ITelemetryConfig, ITelemetrySummary } from '../models/productionModel.js';
import { ITelemetryManager } from '../common/telemetryManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../common/runtimeEventBus.js';
import { IRuntimeStateService } from '../common/runtimeState.js';

/**
 * TelemetryManager implementation for Nutanaa Studio OS Production.
 *
 * Provides configurable telemetry with user consent management.
 */
export class TelemetryManager extends Disposable implements ITelemetryManager {

	declare readonly _serviceBrand: undefined;

	private events: ITelemetryEvent[] = [];
	private sessionId: string = '';
	private sessionStartTime: number = 0;
	private machineId: string = '';

	private readonly _onDidLogEvent = this._register(new Emitter<ITelemetryEvent>());
	private readonly _onDidChangeConfig = this._register(new Emitter<ITelemetryConfig>());

	public readonly onDidLogEvent = Event.fromEmitter(this._onDidLogEvent);
	public readonly onDidChangeConfig = Event.fromEmitter(this._onDidChangeConfig);

	private readonly MAX_EVENTS = 10000;
	private readonly DEFAULT_TELEMETRY_LEVEL: TelemetryLevel = 'balanced';

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.initializeMachineId();
		this.loadConfig();
		this.startSession();
	}

	private initializeMachineId(): void {
		this.machineId = this.storageService.get('telemetry.machineId', 0);
		if (!this.machineId) {
			this.machineId = `machine-${Date.now()}-${Math.random().toString(36).slice(2)}`;
			this.storageService.store('telemetry.machineId', this.machineId, 0);
		}
	}

	// ── Configuration ────────────────────────────────────────────────────────

	getConfig(): ITelemetryConfig {
		return {
			level: this.getLevel(),
			userConsent: this.getUserConsent(),
			machineId: this.machineId,
			sessionId: this.sessionId,
			firstSessionDate: this.getFirstSessionDate(),
			lastSessionDate: Date.now(),
			sessionCount: this.getSessionCount(),
			enabledEvents: this.getEnabledEvents(),
			disabledEvents: this.getDisabledEvents(),
		};
	}

	setLevel(level: TelemetryLevel): void {
		this.storageService.store('telemetry.level', level, 0);
		this.fireConfigChange();
		this.logService.info(`Telemetry level set to ${level}`);
	}

	setUserConsent(consent: boolean): void {
		this.storageService.store('telemetry.consent', consent ? 'true' : 'false', 0);
		this.fireConfigChange();
		this.logService.info(`Telemetry consent set to ${consent}`);
	}

	setEventEnabled(eventName: string, enabled: boolean): void {
		if (enabled) {
			const disabled = this.getDisabledEvents().filter(e => e !== eventName);
			this.storageService.store('telemetry.disabledEvents', JSON.stringify(disabled), 0);
		} else {
			const disabled = [...this.getDisabledEvents(), eventName];
			this.storageService.store('telemetry.disabledEvents', JSON.stringify(disabled), 0);
		}
		this.fireConfigChange();
	}

	getLevel(): TelemetryLevel {
		const stored = this.storageService.get('telemetry.level', 0) as TelemetryLevel;
		return stored || this.DEFAULT_TELEMETRY_LEVEL;
	}

	isEnabled(): boolean {
		return this.getLevel() !== 'off' && this.getUserConsent();
	}

	private getUserConsent(): boolean {
		const stored = this.storageService.get('telemetry.consent', 0);
		return stored === 'true';
	}

	private getFirstSessionDate(): number {
		const stored = this.storageService.get('telemetry.firstSession', 0);
		if (!stored) {
			const now = Date.now();
			this.storageService.store('telemetry.firstSession', now, 0);
			return now;
		}
		return stored;
	}

	private getSessionCount(): number {
		const stored = this.storageService.get('telemetry.sessionCount', 0);
		return stored || 0;
	}

	private getEnabledEvents(): string[] {
		// Events that are always enabled
		return ['session.start', 'session.end', 'error.unhandled'];
	}

	private getDisabledEvents(): string[] {
		const stored = this.storageService.get('telemetry.disabledEvents', 0);
		if (stored) {
			try {
				return JSON.parse(stored);
			} catch {
				return [];
			}
		}
		return [];
	}

	private fireConfigChange(): void {
		const config = this.getConfig();
		this._onDidChangeConfig.fire(config);
		this.updateProductionState();
	}

	// ── Events ───────────────────────────────────────────────────────────────

	logEvent(eventName: string, properties?: Record<string, unknown>, measurements?: Record<string, number>): void {
		if (!this.isEnabled()) {
			return;
		}

		if (!this.isEventEnabled(eventName)) {
			return;
		}

		const event: ITelemetryEvent = {
			id: `telemetry-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			name: eventName,
			timestamp: Date.now(),
			sessionId: this.sessionId,
			userId: undefined, // Anonymous by default
			properties: properties || {},
			measurements: measurements || {},
		};

		this.addEvent(event);
	}

	logPerformance(eventName: string, duration: number, properties?: Record<string, unknown>): void {
		if (!this.isEnabled()) {
			return;
		}

		this.logEvent(eventName, properties, { duration });
	}

	logError(eventName: string, error: unknown, properties?: Record<string, unknown>): void {
		if (!this.isEnabled()) {
			return;
		}

		const errorProperties = {
			...properties,
			errorMessage: error instanceof Error ? error.message : String(error),
			errorStack: error instanceof Error ? error.stack : undefined,
		};

		this.logEvent(eventName, errorProperties);
	}

	logFeatureUsage(featureName: string, properties?: Record<string, unknown>): void {
		if (!this.isEnabled()) {
			return;
		}

		this.logEvent(`feature.usage`, { feature: featureName, ...properties });
	}

	logSessionEvent(eventType: 'start' | 'end' | 'pause' | 'resume'): void {
		this.logEvent(`session.${eventType}`);
	}

	private isEventEnabled(eventName: string): boolean {
		// Check if event is in disabled list
		const disabled = this.getDisabledEvents();
		if (disabled.includes(eventName)) {
			return false;
		}

		// Check telemetry level
		const level = this.getLevel();
		const levelConfig = this.getLevelConfig();
		return levelConfig.includes(eventName) || eventName.startsWith(levelConfig[0]);
	}

	private getLevelConfig(): string[] {
		const level = this.getLevel();

		switch (level) {
			case 'off':
				return [];
			case 'minimal':
				return ['session', 'error'];
			case 'balanced':
				return ['session', 'error', 'feature', 'performance'];
			case 'detailed':
				return ['*']; // All events
			default:
				return [];
		}
	}

	// ── Session Management ───────────────────────────────────────────────────

	getSessionId(): string {
		return this.sessionId;
	}

	startSession(): string {
		this.sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		this.sessionStartTime = Date.now();

		// Increment session count
		const count = this.getSessionCount() + 1;
		this.storageService.store('telemetry.sessionCount', count, 0);

		// Update last session date
		this.storageService.store('telemetry.lastSession', Date.now(), 0);

		this.logSessionEvent('start');
		this.updateProductionState();

		return this.sessionId;
	}

	endSession(): void {
		if (this.sessionId) {
			this.logSessionEvent('end');
			this.sessionId = '';
		}
	}

	getSessionDuration(): number {
		if (!this.sessionStartTime) {
			return 0;
		}
		return Date.now() - this.sessionStartTime;
	}

	// ── Query ─────────────────────────────────────────────────────────────────

	getSummary(since?: number): ITelemetrySummary {
		const filteredEvents = since
			? this.events.filter(e => e.timestamp >= since)
			: this.events;

		const eventsByName = new Map<string, number>();
		const eventsByType = new Map<string, number>();

		for (const event of filteredEvents) {
			const type = event.name.split('.')[0];
			eventsByName.set(event.name, (eventsByName.get(event.name) || 0) + 1);
			eventsByType.set(type, (eventsByType.get(type) || 0) + 1);
		}

		const topEvents = Array.from(eventsByName.entries())
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 10);

		const sessionCount = this.getSessionCount();
		const firstSession = this.getFirstSessionDate();
		const avgDuration = sessionCount > 0
			? this.events.reduce((sum, e) => sum + (e.duration || 0), 0) / this.events.length
			: 0;

		return {
			totalEvents: filteredEvents.length,
			eventsByName,
			eventsByType,
			averageSessionDuration: avgDuration,
			topEvents,
		};
	}

	getRecentEvents(limit = 100): ITelemetryEvent[] {
		return this.events.slice(-limit);
	}

	getEventsByName(eventName: string, limit = 100): ITelemetryEvent[] {
		return this.events
			.filter(e => e.name === eventName)
			.slice(-limit);
	}

	// ── Export ───────────────────────────────────────────────────────────────

	async exportData(since?: number, until?: number): Promise<string> {
		const filteredEvents = this.events.filter(e => {
			if (since && e.timestamp < since) return false;
			if (until && e.timestamp > until) return false;
			return true;
		});

		const exportData = {
			exportDate: Date.now(),
			config: this.getConfig(),
			events: filteredEvents,
			summary: this.getSummary(since),
		};

		return JSON.stringify(exportData, null, 2);
	}

	clearData(before?: number): number {
		const threshold = before || Date.now() - (30 * 24 * 60 * 60 * 1000); // Default 30 days
		const toRemove = this.events.filter(e => e.timestamp < threshold).length;
		this.events = this.events.filter(e => e.timestamp >= threshold);

		if (toRemove > 0) {
			this.logService.info(`Cleared ${toRemove} telemetry events`);
			this.saveEvents();
		}

		return toRemove;
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private addEvent(event: ITelemetryEvent): void {
		this.events.push(event);

		// Trim events if exceeding limit
		if (this.events.length > this.MAX_EVENTS) {
			this.events.splice(0, this.events.length - this.MAX_EVENTS);
		}

		this._onDidLogEvent.fire(event);

		// Fire event on bus periodically (not every event)
		if (this.events.length % 100 === 0) {
			this.runtimeEventBus.fire({
				type: RuntimeEventType.TelemetrySent,
				timestamp: Date.now(),
				payload: {
					eventName: event.name,
					count: this.events.length,
					sampleRate: 1,
				},
			});
		}

		this.saveEvents();
	}

	private loadConfig(): void {
		const stored = this.storageService.get('telemetry.events', 0);
		if (stored) {
			try {
				this.events = JSON.parse(stored);
			} catch {
				this.events = [];
			}
		}
	}

	private saveEvents(): void {
		// Only store recent events
		const recentEvents = this.events.slice(-5000);
		this.storageService.store('telemetry.events', JSON.stringify(recentEvents), 0);
	}

	private updateProductionState(): void {
		this.runtimeStateService.update({
			production: {
				telemetry: this.getConfig(),
				metricsHistory: undefined,
				cacheState: undefined,
				offlineStatus: undefined,
				backupStatus: undefined,
				healthSummary: undefined,
				updateInfo: undefined,
				updateProgress: undefined,
			},
		});
	}
}
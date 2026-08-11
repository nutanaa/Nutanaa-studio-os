/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { LogLevel, ILogEntry, ILogConfig, ILogQuery } from '../../models/productionModel.js';
import { ILoggingManager } from '../../common/ops/loggingManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../../common/runtime/runtimeEventBus.js';

/**
 * LoggingManager implementation for Nutanaa Studio OS Production.
 *
 * Provides structured logging with rotation, retention, and export.
 */
export class LoggingManager extends Disposable implements ILoggingManager {

	declare readonly _serviceBrand: undefined;

	private logs: ILogEntry[] = [];
	private sessionId: string = '';

	private readonly _onDidAddLog = this._register(new Emitter<ILogEntry>());
	public readonly onDidAddLog = this._onDidAddLog.event;

	private readonly MAX_LOGS = 10000;
	private readonly LOG_LEVELS: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'critical'];
	private readonly DEFAULT_LEVEL: LogLevel = 'info';

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.sessionId = `session-${Date.now()}`;
		this.loadLogs();
	}

	// ── Configuration ────────────────────────────────────────────────────────

	getConfig(): ILogConfig {
		const level = this.getLevel();
		return {
			level,
			maxSize: 10 * 1024 * 1024, // 10MB
			maxFiles: 5,
			retention: 30, // 30 days
			format: 'json',
			categories: this.getCategoryLevels(),
			output: ['console', 'file'],
		};
	}

	setLevel(level: LogLevel): void {
		this.storageService.store('logging.level', level, StorageScope.PROFILE, StorageTarget.USER);
		this.logService.info(`Log level set to ${level}`);
	}

	setCategoryLevel(category: string, level: LogLevel): void {
		const levels = this.getCategoryLevels();
		levels[category] = level;
		this.storageService.store('logging.categoryLevels', JSON.stringify(levels), StorageScope.PROFILE, StorageTarget.USER);
	}

	getEffectiveLevel(category?: string): LogLevel {
		const categoryLevels = this.getCategoryLevels();
		if (category && categoryLevels[category]) {
			return categoryLevels[category];
		}
		return this.getLevel();
	}

	private getLevel(): LogLevel {
		const stored = this.storageService.get('logging.level', 0) as LogLevel;
		return stored || this.DEFAULT_LEVEL;
	}

	private getCategoryLevels(): Record<string, LogLevel> {
		const stored = this.storageService.get('logging.categoryLevels', 0);
		if (stored) {
			try {
				return JSON.parse(stored);
			} catch {
				return {};
			}
		}
		return {};
	}

	// ── Logging ──────────────────────────────────────────────────────────────

	log(
		level: LogLevel,
		source: string,
		message: string,
		category: string = 'default',
		context?: Partial<ILogEntry['context']>,
		exception?: unknown
	): void {
		if (!this.shouldLog(level, category)) {
			return;
		}

		const entry = this.createLogEntry(level, source, message, category, context, exception);
		this.addLog(entry);

		// Also log to VS Code console for visibility
		this.logToConsole(entry);
	}

	private shouldLog(level: LogLevel, category: string): boolean {
		const effectiveLevel = this.getEffectiveLevel(category);
		return this.LOG_LEVELS.indexOf(level) >= this.LOG_LEVELS.indexOf(effectiveLevel);
	}

	private createLogEntry(
		level: LogLevel,
		source: string,
		message: string,
		category: string,
		context?: Partial<ILogEntry['context']>,
		exception?: unknown
	): ILogEntry {
		return {
			id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			timestamp: Date.now(),
			level,
			source,
			message,
			category,
			context: {
				sessionId: this.sessionId,
				...context,
			},
			exception: exception instanceof Error ? exception.message : exception ? String(exception) : undefined,
			stackTrace: exception instanceof Error ? exception.stack : undefined,
		};
	}

	private addLog(entry: ILogEntry): void {
		this.logs.push(entry);

		// Trim logs if exceeding limit
		if (this.logs.length > this.MAX_LOGS) {
			this.logs.splice(0, this.logs.length - this.MAX_LOGS);
		}

		this._onDidAddLog.fire(entry);

		// Fire event on bus periodically (not every log)
		if (this.logs.length % 100 === 0) {
			this.runtimeEventBus.fire({
				type: RuntimeEventType.Log,
				timestamp: Date.now(),
				payload: {
					level: entry.level,
					message: entry.message,
					source: entry.source,
				},
			});
		}

		this.saveLogs();
	}

	private logToConsole(entry: ILogEntry): void {
		const consoleMethods: Record<LogLevel, (message: string, ...args: unknown[]) => void> = {
			trace: this.logService.trace.bind(this.logService),
			debug: this.logService.debug.bind(this.logService),
			info: this.logService.info.bind(this.logService),
			warn: this.logService.warn.bind(this.logService),
			error: this.logService.error.bind(this.logService),
			critical: this.logService.error.bind(this.logService),
		};

		const method = consoleMethods[entry.level];
		if (method) {
			method(`[${entry.source}] ${entry.message}`, entry.exception);
		}
	}

	trace(source: string, message: string, category?: string, context?: ILogEntry['context'], exception?: unknown): void {
		this.log('trace', source, message, category, context, exception);
	}

	debug(source: string, message: string, category?: string, context?: ILogEntry['context'], exception?: unknown): void {
		this.log('debug', source, message, category, context, exception);
	}

	info(source: string, message: string, category?: string, context?: ILogEntry['context'], exception?: unknown): void {
		this.log('info', source, message, category, context, exception);
	}

	warn(source: string, message: string, category?: string, context?: ILogEntry['context'], exception?: unknown): void {
		this.log('warn', source, message, category, context, exception);
	}

	error(source: string, message: string, category?: string, context?: ILogEntry['context'], exception?: unknown): void {
		this.log('error', source, message, category, context, exception);
	}

	critical(source: string, message: string, category?: string, context?: ILogEntry['context'], exception?: unknown): void {
		this.log('critical', source, message, category, context, exception);
	}

	// ── Query ─────────────────────────────────────────────────────────────────

	query(query: ILogQuery): ILogEntry[] {
		let results = [...this.logs];

		if (query.startTime) {
			results = results.filter(l => l.timestamp >= query.startTime!);
		}
		if (query.endTime) {
			results = results.filter(l => l.timestamp <= query.endTime!);
		}
		if (query.level) {
			results = results.filter(l => l.level === query.level);
		}
		if (query.category) {
			results = results.filter(l => l.category === query.category);
		}
		if (query.source) {
			results = results.filter(l => l.source === query.source);
		}
		if (query.search) {
			const searchLower = query.search.toLowerCase();
			results = results.filter(l =>
				l.message.toLowerCase().includes(searchLower) ||
				l.source.toLowerCase().includes(searchLower)
			);
		}

		if (query.limit) {
			results = results.slice(0, query.limit);
		}
		if (query.offset) {
			results = results.slice(query.offset);
		}

		// Sort by timestamp descending (newest first)
		return results.sort((a, b) => b.timestamp - a.timestamp);
	}

	getRecentLogs(limit = 100): ILogEntry[] {
		return this.query({ limit });
	}

	getLogsByCategory(category: string, limit = 100): ILogEntry[] {
		return this.query({ category, limit });
	}

	getLogsByLevel(level: LogLevel, limit = 100): ILogEntry[] {
		return this.query({ level, limit });
	}

	search(search: string, limit = 100): ILogEntry[] {
		return this.query({ search, limit });
	}

	// ── Export ───────────────────────────────────────────────────────────────

	exportToJson(query?: ILogQuery): string {
		const logs = query ? this.query(query) : this.logs;
		return JSON.stringify({
			exportDate: Date.now(),
			config: this.getConfig(),
			logs,
		}, null, 2);
	}

	exportToText(query?: ILogQuery): string {
		const logs = query ? this.query(query) : this.logs;

		const lines = logs.map(l => {
			const date = new Date(l.timestamp).toISOString();
			const context = l.context
				? ` [session:${l.context.sessionId}${l.context.traceId ? ` trace:${l.context.traceId}` : ''}]`
				: '';
			const exception = l.exception ? `\n  Exception: ${l.exception}${l.stackTrace ? `\n${l.stackTrace}` : ''}` : '';
			return `${date} [${l.level.toUpperCase()}] [${l.source}] ${l.message}${context}${exception}`;
		});

		return lines.join('\n');
	}

	clearLogs(before?: number): number {
		const threshold = before || Date.now() - (30 * 24 * 60 * 60 * 1000); // Default 30 days
		const toRemove = this.logs.filter(l => l.timestamp < threshold).length;

		this.logs = this.logs.filter(l => l.timestamp >= threshold);

		if (toRemove > 0) {
			this.logService.info(`Cleared ${toRemove} log entries`);
			this.saveLogs();
		}

		return toRemove;
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private loadLogs(): void {
		const stored = this.storageService.get('nutanaa.logs', 0);
		if (stored) {
			try {
				this.logs = JSON.parse(stored);
			} catch {
				this.logs = [];
			}
		}
	}

	private saveLogs(): void {
		// Only store recent logs
		const recentLogs = this.logs.slice(-5000);
		this.storageService.store('nutanaa.logs', JSON.stringify(recentLogs), StorageScope.PROFILE, StorageTarget.USER);
	}
}
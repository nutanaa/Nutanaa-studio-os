/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { LogLevel, ILogEntry, ILogConfig, ILogQuery } from '../models/productionModel.js';

/**
 * Service for structured logging in Nutanaa Studio OS Production.
 *
 * Responsibilities:
 * - Structured JSON logs
 * - Rolling log files
 * - Log retention
 * - Log filtering
 * - Log export
 * - Diagnostics
 */
export const ILoggingManager = createDecorator<ILoggingManager>('nutanaaLoggingManager');

export interface ILoggingManager {

	// ── Configuration ────────────────────────────────────────────────────────

	/**
	 * Get current log configuration.
	 * @returns Current config
	 */
	getConfig(): ILogConfig;

	/**
	 * Update log level.
	 * @param level New log level
	 */
	setLevel(level: LogLevel): void;

	/**
	 * Update category level.
	 * @param category Category name
	 * @param level Log level
	 */
	setCategoryLevel(category: string, level: LogLevel): void;

	/**
	 * Get effective log level for a category.
	 * @param category Category name
	 * @returns Effective log level
	 */
	getEffectiveLevel(category?: string): LogLevel;

	// ── Logging ──────────────────────────────────────────────────────────────

	/**
	 * Log a message.
	 * @param level Log level
	 * @param source Source module
	 * @param message Log message
	 * @param category Log category
	 * @param context Log context
	 * @param exception Exception if any
	 */
	log(
		level: LogLevel,
		source: string,
		message: string,
		category?: string,
		context?: Partial<{
			requestId: string;
			traceId: string;
			userId: string;
			workspaceId: string;
			agentId: string;
			workflowId: string;
		}>,
		exception?: unknown
	): void;

	/**
	 * Log trace message.
	 */
	trace(source: string, message: string, category?: string, context?: ILogEntry['context'], exception?: unknown): void;

	/**
	 * Log debug message.
	 */
	debug(source: string, message: string, category?: string, context?: ILogEntry['context'], exception?: unknown): void;

	/**
	 * Log info message.
	 */
	info(source: string, message: string, category?: string, context?: ILogEntry['context'], exception?: unknown): void;

	/**
	 * Log warning message.
	 */
	warn(source: string, message: string, category?: string, context?: ILogEntry['context'], exception?: unknown): void;

	/**
	 * Log error message.
	 */
	error(source: string, message: string, category?: string, context?: ILogEntry['context'], exception?: unknown): void;

	/**
	 * Log critical message.
	 */
	critical(source: string, message: string, category?: string, context?: ILogEntry['context'], exception?: unknown): void;

	// ── Query ─────────────────────────────────────────────────────────────────

	/**
	 * Query logs.
	 * @param query Query parameters
	 * @returns Matching log entries
	 */
	query(query: ILogQuery): ILogEntry[];

	/**
	 * Get recent logs.
	 * @param limit Maximum entries
	 * @returns Recent logs
	 */
	getRecentLogs(limit?: number): ILogEntry[];

	/**
	 * Get logs by category.
	 * @param category Category name
	 * @param limit Maximum entries
	 * @returns Log entries
	 */
	getLogsByCategory(category: string, limit?: number): ILogEntry[];

	/**
	 * Get logs by level.
	 * @param level Log level
	 * @param limit Maximum entries
	 * @returns Log entries
	 */
	getLogsByLevel(level: LogLevel, limit?: number): ILogEntry[];

	/**
	 * Search logs.
	 * @param search Search string
	 * @param limit Maximum entries
	 * @returns Matching logs
	 */
	search(search: string, limit?: number): ILogEntry[];

	// ── Export ───────────────────────────────────────────────────────────────

	/**
	 * Export logs to JSON.
	 * @param query Query parameters
	 * @returns JSON string
	 */
	exportToJson(query?: ILogQuery): string;

	/**
	 * Export logs to text.
	 * @param query Query parameters
	 * @returns Text string
	 */
	exportToText(query?: ILogQuery): string;

	/**
	 * Clear logs.
	 * @param before Clear logs before this time
	 * @returns Number of entries cleared
	 */
	clearLogs(before?: number): number;

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when log entry is added.
	 */
	onDidAddLog: (listener: (entry: ILogEntry) => void) => { dispose(): void };
}
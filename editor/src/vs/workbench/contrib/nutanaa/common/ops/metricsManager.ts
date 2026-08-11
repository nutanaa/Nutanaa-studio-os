/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../../base/common/event.js';
import {
	ISystemMetrics,
	IPerformanceMetrics,
	IMetricsHistory,
} from '../../models/productionModel.js';

/**
 * Service for collecting and managing metrics in Nutanaa Studio OS Production.
 *
 * Responsibilities:
 * - Collect system metrics (CPU, memory, GPU, disk, network)
 * - Collect performance metrics (LLM latency, tool latency, workflow latency)
 * - Collect agent and queue statistics
 * - Track token usage and costs
 * - Provide metrics history and trends
 */
export const IMetricsManager = createDecorator<IMetricsManager>('nutanaaMetricsManager');

export interface IMetricsManager {

	// ── System Metrics ───────────────────────────────────────────────────────

	/**
	 * Get current system metrics.
	 * @returns Current system metrics
	 */
	getSystemMetrics(): ISystemMetrics;

	/**
	 * Get CPU metrics.
	 * @returns CPU metrics
	 */
	getCpuMetrics(): Promise<{
		usage: number;
		cores: number;
		frequency: number;
		processes: number;
	}>;

	/**
	 * Get memory metrics.
	 * @returns Memory metrics
	 */
	getMemoryMetrics(): Promise<{
		used: number;
		total: number;
		available: number;
		percentage: number;
		heapUsed: number;
		heapTotal: number;
	}>;

	/**
	 * Get GPU metrics.
	 * @returns GPU metrics
	 */
	getGpuMetrics(): Promise<{
		usage: number;
		memory: number;
	}>;

	/**
	 * Get disk metrics.
	 * @returns Disk metrics
	 */
	getDiskMetrics(): Promise<{
		read: number;
		write: number;
		usage: number;
	}>;

	/**
	 * Get network metrics.
	 * @returns Network metrics
	 */
	getNetworkMetrics(): Promise<{
		bytesIn: number;
		bytesOut: number;
		latency: number;
	}>;

	// ── Performance Metrics ──────────────────────────────────────────────────

	/**
	 * Get current performance metrics.
	 * @returns Performance metrics
	 */
	getPerformanceMetrics(): IPerformanceMetrics;

	/**
	 * Record LLM request latency.
	 * @param provider Provider name
	 * @param model Model name
	 * @param duration Duration in milliseconds
	 * @param tokens Prompt token count
	 */
	recordLLMLatency(provider: string, model: string, duration: number, tokens: number): void;

	/**
	 * Record tool execution latency.
	 * @param toolName Tool name
	 * @param duration Duration in milliseconds
	 */
	recordToolLatency(toolName: string, duration: number): void;

	/**
	 * Record workflow execution latency.
	 * @param workflowId Workflow ID
	 * @param duration Duration in milliseconds
	 */
	recordWorkflowLatency(workflowId: string, duration: number): void;

	/**
	 * Record agent execution latency.
	 * @param agentId Agent ID
	 * @param duration Duration in milliseconds
	 */
	recordAgentLatency(agentId: string, duration: number): void;

	/**
	 * Update queue statistics.
	 * @param stats Queue statistics
	 */
	updateQueueStats(stats: {
		queued: number;
		processing: number;
		completed: number;
		failed: number;
		averageWaitTime: number;
	}): void;

	/**
	 * Update provider statistics.
	 * @param provider Provider name
	 * @param stats Provider statistics
	 */
	updateProviderStats(provider: string, stats: {
		requests: number;
		errors: number;
		retries: number;
		timeouts: number;
	}): void;

	/**
	 * Record token usage.
	 * @param provider Provider name
	 * @param promptTokens Prompt token count
	 * @param completionTokens Completion token count
	 * @param cost Cost in USD
	 */
	recordTokenUsage(provider: string, promptTokens: number, completionTokens: number, cost: number): void;

	// ── History ───────────────────────────────────────────────────────────────

	/**
	 * Get metrics history.
	 * @param duration Time range in milliseconds
	 * @returns Metrics history
	 */
	getHistory(duration: number): IMetricsHistory;

	/**
	 * Get metrics summary.
	 * @returns Summary statistics
	 */
	getSummary(): {
		cpu: { average: number; peak: number };
		memory: { average: number; peak: number; current: number };
		llmLatency: { average: number; p95: number };
		toolLatency: { average: number; p95: number };
		totalTokens: number;
		totalCost: number;
	};

	/**
	 * Clear metrics history.
	 * @param before Clear events before this time
	 * @returns Number of entries cleared
	 */
	clearHistory(before?: number): number;

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when metrics are updated.
	 */
	onDidUpdateMetrics: Event<{ system: ISystemMetrics; performance: IPerformanceMetrics }>;
}
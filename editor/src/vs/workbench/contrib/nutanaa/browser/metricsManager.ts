/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import {
	ISystemMetrics,
	IPerformanceMetrics,
	IMetricsHistory,
	ILatencyMetrics,
	IQueueMetrics,
	IProviderMetrics,
	ITokenUsageMetrics,
} from '../models/productionModel.js';
import { IMetricsManager } from '../common/metricsManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../common/runtimeEventBus.js';
import { IRuntimeStateService } from '../common/runtimeState.js';

/**
 * MetricsManager implementation for Nutanaa Studio OS Production.
 *
 * Collects and manages system and performance metrics.
 */
export class MetricsManager extends Disposable implements IMetricsManager {

	declare readonly _serviceBrand: undefined;

	private systemMetricsHistory: ISystemMetrics[] = [];
	private performanceHistory: IPerformanceMetrics[] = [];

	private llmLatencies = new Map<string, number[]>();
	private toolLatencies = new Map<string, number[]>();
	private workflowLatencies: number[] = [];
	private agentLatencies: number[] = [];

	private queueStats: IQueueMetrics = {
		queued: 0,
		processing: 0,
		completed: 0,
		failed: 0,
		averageWaitTime: 0,
	};

	private providerStats = new Map<string, IProviderMetrics>();
	private tokenUsage = new Map<string, { prompt: number; completion: number; total: number; cost: number }>();

	private readonly _onDidUpdateMetrics = this._register(new Emitter<{ system: ISystemMetrics; performance: IPerformanceMetrics }>());

	public readonly onDidUpdateMetrics = Event.fromEmitter(this._onDidUpdateMetrics);

	private readonly MAX_HISTORY = 3600; // 1 hour of samples (1 per second)
	private readonly UPDATE_INTERVAL = 1000; // 1 second

	private updateInterval: ReturnType<typeof setInterval> | undefined;

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.loadHistory();
		this.startPeriodicUpdate();
	}

	private startPeriodicUpdate(): void {
		this.updateInterval = setInterval(() => {
			this.collectAndUpdateMetrics();
		}, this.UPDATE_INTERVAL);
	}

	private async collectAndUpdateMetrics(): Promise<void> {
		const system = await this.collectSystemMetrics();
		const performance = this.collectPerformanceMetrics();

		this.addSystemMetrics(system);
		this.addPerformanceMetrics(performance);

		this._onDidUpdateMetrics.fire({ system, performance });

		// Update runtime state
		this.updateProductionState();

		// Fire event on bus
		this.runtimeEventBus.fire({
			type: RuntimeEventType.MetricsUpdated,
			timestamp: Date.now(),
			payload: { systemMetrics: system, performanceMetrics: performance },
		});
	}

	// ── System Metrics ───────────────────────────────────────────────────────

	getSystemMetrics(): ISystemMetrics {
		return this.systemMetricsHistory.length > 0
			? this.systemMetricsHistory[this.systemMetricsHistory.length - 1]
			: this.createEmptySystemMetrics();
	}

	private async collectSystemMetrics(): Promise<ISystemMetrics> {
		const memory = await this.getMemoryMetrics();
		const cpu = await this.getCpuMetrics();
		const gpu = await this.getGpuMetrics();
		const disk = await this.getDiskMetrics();
		const network = await this.getNetworkMetrics();

		return {
			cpu,
			memory,
			gpu,
			disk,
			network,
			timestamp: Date.now(),
		};
	}

	private createEmptySystemMetrics(): ISystemMetrics {
		return {
			cpu: { usage: 0, cores: 1, frequency: 0, processes: 0 },
			memory: { used: 0, total: 0, available: 0, percentage: 0, heapUsed: 0, heapTotal: 0 },
			gpu: { usage: 0, memory: 0 },
			disk: { read: 0, write: 0, readCount: 0, writeCount: 0, usage: 0 },
			network: { bytesIn: 0, bytesOut: 0, latency: 0, connectionCount: 0 },
			timestamp: Date.now(),
		};
	}

	async getCpuMetrics(): Promise<{ usage: number; cores: number; frequency: number; processes: number }> {
		// Mock implementation - in production would use native APIs
		return {
			usage: Math.random() * 30 + 10, // 10-40%
			cores: navigator.hardwareConcurrency || 4,
			frequency: 3000, // 3GHz
			processes: 10,
		};
	}

	async getMemoryMetrics(): Promise<{ used: number; total: number; available: number; percentage: number; heapUsed: number; heapTotal: number }> {
		// Mock implementation - in production would use native APIs
		const total = 16 * 1024 * 1024 * 1024; // 16GB
		const used = Math.random() * (total * 0.6) + (total * 0.2);
		const available = total - used;

		const perf = performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } };
		const heapUsed = perf.memory?.usedJSHeapSize || 0;
		const heapTotal = perf.memory?.totalJSHeapSize || 0;

		return {
			used,
			total,
			available,
			percentage: (used / total) * 100,
			heapUsed,
			heapTotal,
		};
	}

	async getGpuMetrics(): Promise<{ usage: number; memory: number }> {
		return { usage: 0, memory: 0 };
	}

	async getDiskMetrics(): Promise<{ read: number; write: number; usage: number }> {
		return { read: 0, write: 0, usage: 50 };
	}

	async getNetworkMetrics(): Promise<{ bytesIn: number; bytesOut: number; latency: number }> {
		return { bytesIn: 0, bytesOut: 0, latency: 0 };
	}

	// ── Performance Metrics ──────────────────────────────────────────────────

	getPerformanceMetrics(): IPerformanceMetrics {
		return this.collectPerformanceMetrics();
	}

	private collectPerformanceMetrics(): IPerformanceMetrics {
		return {
			llmLatency: this.calculateLatencyMetrics(this.llmLatencies),
			toolLatency: this.calculateLatencyMetrics(this.toolLatencies),
			workflowLatency: this.calculateArrayLatencyMetrics(this.workflowLatencies),
			agentLatency: this.calculateArrayLatencyMetrics(this.agentLatencies),
			queueStats: { ...this.queueStats },
			providerStats: Object.fromEntries(this.providerStats),
			tokenUsage: this.calculateTokenUsageMetrics(),
		};
	}

	recordLLMLatency(provider: string, model: string, duration: number, tokens: number): void {
		const key = `${provider}:${model}`;
		const latencies = this.llmLatencies.get(key) || [];
		latencies.push(duration);
		if (latencies.length > 1000) latencies.shift();
		this.llmLatencies.set(key, latencies);
	}

	recordToolLatency(toolName: string, duration: number): void {
		const latencies = this.toolLatencies.get(toolName) || [];
		latencies.push(duration);
		if (latencies.length > 1000) latencies.shift();
		this.toolLatencies.set(toolName, latencies);
	}

	recordWorkflowLatency(workflowId: string, duration: number): void {
		this.workflowLatencies.push(duration);
		if (this.workflowLatencies.length > 10000) this.workflowLatencies.shift();
	}

	recordAgentLatency(agentId: string, duration: number): void {
		this.agentLatencies.push(duration);
		if (this.agentLatencies.length > 10000) this.agentLatencies.shift();
	}

	updateQueueStats(stats: { queued: number; processing: number; completed: number; failed: number; averageWaitTime: number }): void {
		this.queueStats = { ...stats };
	}

	updateProviderStats(provider: string, stats: { requests: number; errors: number; retries: number; timeouts: number }): void {
		const existing = this.providerStats.get(provider) || {
			requests: 0,
			errors: 0,
			retries: 0,
			timeouts: 0,
		};
		this.providerStats.set(provider, {
			requests: existing.requests + stats.requests,
			errors: existing.errors + stats.errors,
			retries: existing.retries + stats.retries,
			timeouts: existing.timeouts + stats.timeouts,
		});
	}

	recordTokenUsage(provider: string, promptTokens: number, completionTokens: number, cost: number): void {
		const existing = this.tokenUsage.get(provider) || { prompt: 0, completion: 0, total: 0, cost: 0 };
		this.tokenUsage.set(provider, {
			prompt: existing.prompt + promptTokens,
			completion: existing.completion + completionTokens,
			total: existing.total + promptTokens + completionTokens,
			cost: existing.cost + cost,
		});
	}

	// ── History ───────────────────────────────────────────────────────────────

	getHistory(duration: number): IMetricsHistory {
		const cutoff = Date.now() - duration;
		const system = this.systemMetricsHistory.filter(m => m.timestamp >= cutoff);
		const performance = this.performanceHistory.filter(m => m.timestamp >= cutoff);

		return {
			system,
			performance,
			timestamp: Date.now(),
		};
	}

	getSummary(): {
		cpu: { average: number; peak: number };
		memory: { average: number; peak: number; current: number };
		llmLatency: { average: number; p95: number };
		toolLatency: { average: number; p95: number };
		totalTokens: number;
		totalCost: number;
	} {
		const cpuMetrics = this.systemMetricsHistory.map(m => m.cpu.usage);
		const memoryMetrics = this.systemMetricsHistory.map(m => m.memory.percentage);
		const currentMemory = this.systemMetricsHistory.length > 0
			? this.systemMetricsHistory[this.systemMetricsHistory.length - 1].memory
			: { used: 0, total: 0 };

		const llmLatency = this.calculateLatencyMetrics(this.llmLatencies);
		const toolLatency = this.calculateLatencyMetrics(this.toolLatencies);

		let totalTokens = 0;
		let totalCost = 0;
		for (const [, usage] of this.tokenUsage) {
			totalTokens += usage.total;
			totalCost += usage.cost;
		}

		return {
			cpu: {
				average: this.average(cpuMetrics),
				peak: Math.max(...cpuMetrics, 0),
			},
			memory: {
				average: this.average(memoryMetrics),
				peak: Math.max(...memoryMetrics, 0),
				current: currentMemory.used,
			},
			llmLatency: {
				average: llmLatency.average,
				p95: llmLatency.p95,
			},
			toolLatency: {
				average: toolLatency.average,
				p95: toolLatency.p95,
			},
			totalTokens,
			totalCost,
		};
	}

	clearHistory(before?: number): number {
		const threshold = before || Date.now() - (24 * 60 * 60 * 1000); // Default 24 hours
		const beforeCount = this.systemMetricsHistory.length;

		this.systemMetricsHistory = this.systemMetricsHistory.filter(m => m.timestamp >= threshold);
		this.performanceHistory = this.performanceHistory.filter(m => m.timestamp >= threshold);

		const cleared = beforeCount - this.systemMetricsHistory.length;
		if (cleared > 0) {
			this.logService.info(`Cleared ${cleared} metrics entries`);
			this.saveHistory();
		}

		return cleared;
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private addSystemMetrics(metrics: ISystemMetrics): void {
		this.systemMetricsHistory.push(metrics);
		if (this.systemMetricsHistory.length > this.MAX_HISTORY) {
			this.systemMetricsHistory.shift();
		}
	}

	private addPerformanceMetrics(metrics: IPerformanceMetrics): void {
		this.performanceHistory.push(metrics);
		if (this.performanceHistory.length > this.MAX_HISTORY) {
			this.performanceHistory.shift();
		}
	}

	private calculateLatencyMetrics(latencies: Map<string, number[]>): ILatencyMetrics {
		const allLatencies: number[] = [];
		for (const values of latencies.values()) {
			allLatencies.push(...values);
		}

		if (allLatencies.length === 0) {
			return { average: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0, count: 0 };
		}

		allLatencies.sort((a, b) => a - b);

		return {
			average: this.average(allLatencies),
			p50: this.percentile(allLatencies, 50),
			p95: this.percentile(allLatencies, 95),
			p99: this.percentile(allLatencies, 99),
			min: allLatencies[0],
			max: allLatencies[allLatencies.length - 1],
			count: allLatencies.length,
		};
	}

	private calculateArrayLatencyMetrics(latencies: number[]): ILatencyMetrics {
		if (latencies.length === 0) {
			return { average: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0, count: 0 };
		}

		const sorted = [...latencies].sort((a, b) => a - b);

		return {
			average: this.average(sorted),
			p50: this.percentile(sorted, 50),
			p95: this.percentile(sorted, 95),
			p99: this.percentile(sorted, 99),
			min: sorted[0],
			max: sorted[sorted.length - 1],
			count: sorted.length,
		};
	}

	private calculateTokenUsageMetrics(): ITokenUsageMetrics {
		let prompt = 0;
		let completion = 0;
		let total = 0;
		let cost = 0;
		const byProvider: Map<string, { prompt: number; completion: number; total: number; cost: number }> = new Map();

		for (const [provider, usage] of this.tokenUsage) {
			prompt += usage.prompt;
			completion += usage.completion;
			total += usage.total;
			cost += usage.cost;
			byProvider.set(provider, usage);
		}

		return {
			prompt,
			completion,
			total,
			cost,
			byProvider,
		};
	}

	private average(values: number[]): number {
		if (values.length === 0) return 0;
		return values.reduce((a, b) => a + b, 0) / values.length;
	}

	private percentile(sorted: number[], p: number): number {
		if (sorted.length === 0) return 0;
		const index = Math.ceil((p / 100) * sorted.length) - 1;
		return sorted[Math.max(0, index)];
	}

	private updateProductionState(): void {
		const history: IMetricsHistory = {
			system: [...this.systemMetricsHistory],
			performance: [...this.performanceHistory],
			timestamp: Date.now(),
		};

		this.runtimeStateService.update({
			production: {
				telemetry: undefined,
				metricsHistory: history,
				cacheState: undefined,
				offlineStatus: undefined,
				backupStatus: undefined,
				healthSummary: undefined,
				updateInfo: undefined,
				updateProgress: undefined,
			},
		});
	}

	private loadHistory(): void {
		const stored = this.storageService.get('nutanaa.metrics', 0);
		if (stored) {
			try {
				const data = JSON.parse(stored);
				this.systemMetricsHistory = data.system || [];
				this.performanceHistory = data.performance || [];
			} catch {
				this.systemMetricsHistory = [];
				this.performanceHistory = [];
			}
		}
	}

	private saveHistory(): void {
		const data = {
			system: this.systemMetricsHistory.slice(-this.MAX_HISTORY),
			performance: this.performanceHistory.slice(-this.MAX_HISTORY),
			savedAt: Date.now(),
		};

		this.storageService.store('nutanaa.metrics', JSON.stringify(data), 0);
	}

	override dispose(): void {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
		}
		this.saveHistory();
		super.dispose();
	}
}
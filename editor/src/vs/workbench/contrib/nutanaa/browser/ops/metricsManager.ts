/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import {
	ISystemMetrics,
	IPerformanceMetrics,
	IMetricsHistory,
	ILatencyMetrics,
	IQueueMetrics,
	IProviderMetrics,
	ITokenUsageMetrics,
} from '../../models/productionModel.js';
import { IMetricsManager } from '../../common/ops/metricsManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../../common/runtime/runtimeEventBus.js';
import { IRuntimeStateService, IRuntimeState } from '../../common/runtime/runtimeState.js';
import { NUTANAA_RUNTIME_HTTP_URL } from '../../common/nutanaa.js';

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

	public readonly onDidUpdateMetrics = this._onDidUpdateMetrics.event;

	private readonly MAX_HISTORY = 3600; // 1 hour of samples (1 per second)
	private readonly UPDATE_INTERVAL = 1000; // 1 second

	private updateInterval: ReturnType<typeof setInterval> | undefined;
	private backendAvailable = false;

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

		this.updateProductionState();

		this.runtimeEventBus.fire({
			type: RuntimeEventType.MetricsUpdated,
			timestamp: Date.now(),
			payload: { systemMetrics: system, performanceMetrics: performance },
		});
	}

	// ── System Metrics ───────────────────────────────────────────────────────

	getSystemMetrics(): ISystemMetrics {
		if (!this.backendAvailable) {
			return this.createEmptySystemMetrics();
		}
		return this.systemMetricsHistory.length > 0
			? this.systemMetricsHistory[this.systemMetricsHistory.length - 1]
			: this.createEmptySystemMetrics();
	}

	private async collectSystemMetrics(): Promise<ISystemMetrics> {
		const backend = await this.fetchSystemMetricsFromBackend();
		if (backend) {
			this.addSystemMetrics(backend);
			return backend;
		}

		return this.createEmptySystemMetrics();
	}

	private async fetchSystemMetricsFromBackend(): Promise<ISystemMetrics | null> {
		try {
			const response = await fetch(`${NUTANAA_RUNTIME_HTTP_URL}/system-metrics`);
			if (!response.ok) {
				this.backendAvailable = false;
				return null;
			}
			const data = await response.json() as Record<string, unknown>;
			this.backendAvailable = true;
			return {
				cpu: data.cpu as ISystemMetrics['cpu'],
				memory: data.memory as ISystemMetrics['memory'],
				gpu: (data.gpu as ISystemMetrics['gpu']) || { usage: 0, memory: 0 },
				disk: (data.disk as ISystemMetrics['disk']) || { read: 0, write: 0, readCount: 0, writeCount: 0, usage: 0 },
				network: (data.network as ISystemMetrics['network']) || { bytesIn: 0, bytesOut: 0, latency: 0, connectionCount: 0 },
				timestamp: (data.timestamp as number) || Date.now(),
			};
		} catch {
			this.backendAvailable = false;
			return null;
		}
	}

	private createEmptySystemMetrics(): ISystemMetrics {
		return {
			cpu: { usage: 0, cores: 1, frequency: 0, processes: 0 },
			memory: { used: 0, total: 0, available: 0, percentage: 0, heapUsed: 0, heapTotal: 0, external: 0 },
			gpu: { usage: 0, memory: 0 },
			disk: { read: 0, write: 0, readCount: 0, writeCount: 0, usage: 0 },
			network: { bytesIn: 0, bytesOut: 0, latency: 0, connectionCount: 0 },
			timestamp: Date.now(),
		};
	}

	async getCpuMetrics(): Promise<{ usage: number; cores: number; frequency: number; processes: number }> {
		const latest = this.getSystemMetrics();
		return latest.cpu;
	}

	async getMemoryMetrics(): Promise<{ used: number; total: number; available: number; percentage: number; heapUsed: number; heapTotal: number; external: number }> {
		const latest = this.getSystemMetrics();
		return latest.memory;
	}

	async getGpuMetrics(): Promise<{ usage: number; memory: number }> {
		return { usage: 0, memory: 0 };
	}

	async getDiskMetrics(): Promise<{ read: number; write: number; readCount: number; writeCount: number; usage: number }> {
		return { read: 0, write: 0, readCount: 0, writeCount: 0, usage: 50 };
	}

	async getNetworkMetrics(): Promise<{ bytesIn: number; bytesOut: number; latency: number; connectionCount: number }> {
		return { bytesIn: 0, bytesOut: 0, latency: 0, connectionCount: 0 };
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
		providerStats: this.aggregateProviderStats(),
		tokenUsage: this.calculateTokenUsageMetrics(),
		timestamp: Date.now(),
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
		workflowLatency: { average: number; p95: number };
		agentLatency: { average: number; p95: number };
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
		const workflowLatency = this.calculateArrayLatencyMetrics(this.workflowLatencies);
		const agentLatency = this.calculateArrayLatencyMetrics(this.agentLatencies);

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
			workflowLatency: {
				average: workflowLatency.average,
				p95: workflowLatency.p95,
			},
			agentLatency: {
				average: agentLatency.average,
				p95: agentLatency.p95,
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

	private aggregateProviderStats(): IProviderMetrics {
		let requests = 0;
		let errors = 0;
		let retries = 0;
		let timeouts = 0;
		for (const stats of this.providerStats.values()) {
			requests += stats.requests;
			errors += stats.errors;
			retries += stats.retries;
			timeouts += stats.timeouts;
		}
		return { requests, errors, retries, timeouts };
	}

	private previousProductionMetrics: {
		cpu: number;
		memory: number;
		gpu: number;
		disk: number;
		network: number;
		llmLatency: number;
		toolLatency: number;
		workflowLatency: number;
		agentLatency: number;
		tokenUsage: number;
	} | undefined;

	private readonly METRICS_CHANGE_THRESHOLD = 0.01;

	private updateProductionState(): void {
		const summary = this.getSummary();

		const newMetrics = {
			cpu: summary.cpu.average,
			memory: summary.memory.current,
			gpu: 0,
			disk: 0,
			network: 0,
			llmLatency: summary.llmLatency.average,
			toolLatency: summary.toolLatency.average,
			workflowLatency: summary.workflowLatency?.average || 0,
			agentLatency: summary.agentLatency?.average || 0,
			tokenUsage: summary.totalTokens,
		};

		if (this.previousProductionMetrics && this.shouldSkipMetricsUpdate(this.previousProductionMetrics, newMetrics)) {
			return;
		}

		this.previousProductionMetrics = newMetrics;

		this.runtimeStateService.update({
			production: {
				metrics: {
					cpu: summary.cpu.average,
					memory: summary.memory.current,
					gpu: 0,
					disk: 0,
					network: 0,
					llmLatency: summary.llmLatency.average,
					toolLatency: summary.toolLatency.average,
					workflowLatency: summary.workflowLatency?.average || 0,
					agentLatency: summary.agentLatency?.average || 0,
					tokenUsage: summary.totalTokens,
				},
			},
		} as unknown as Partial<IRuntimeState>);
	}

	private shouldSkipMetricsUpdate(
		prev: { cpu: number; memory: number; gpu: number; disk: number; network: number; llmLatency: number; toolLatency: number; workflowLatency: number; agentLatency: number; tokenUsage: number },
		next: { cpu: number; memory: number; gpu: number; disk: number; network: number; llmLatency: number; toolLatency: number; workflowLatency: number; agentLatency: number; tokenUsage: number }
	): boolean {
		if (!prev) return false;

		const threshold = this.METRICS_CHANGE_THRESHOLD;

		return (
			Math.abs(prev.cpu - next.cpu) < threshold &&
			Math.abs(prev.memory - next.memory) < threshold &&
			prev.gpu === next.gpu &&
			prev.disk === next.disk &&
			prev.network === next.network &&
			Math.abs(prev.llmLatency - next.llmLatency) < threshold &&
			Math.abs(prev.toolLatency - next.toolLatency) < threshold &&
			Math.abs(prev.workflowLatency - next.workflowLatency) < threshold &&
			Math.abs(prev.agentLatency - next.agentLatency) < threshold &&
			prev.tokenUsage === next.tokenUsage
		);
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

		this.storageService.store('nutanaa.metrics', JSON.stringify(data), StorageScope.PROFILE, StorageTarget.USER);
	}

	override dispose(): void {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
		}
		this.saveHistory();
		super.dispose();
	}
}
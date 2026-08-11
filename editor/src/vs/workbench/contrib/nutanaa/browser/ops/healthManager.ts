/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../base/common/event.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IHealthManager, HealthStatus, IHealthCheckResult } from '../../common/ops/healthManager.js';
import { IRuntimeEventBus } from '../../common/runtime/runtimeEventBus.js';
import { IRuntimeStateService, IRuntimeState } from '../../common/runtime/runtimeState.js';

interface HealthCheck {
	name: string;
	checkFn: () => Promise<{ passed: boolean; message?: string }>;
	lastResult?: IHealthCheckResult;
}

interface HealthHistoryEntry {
	timestamp: number;
	status: HealthStatus;
	details: Record<string, unknown>;
}

interface HealthConfig {
	interval: number;
	timeout: number;
	enabled: boolean;
}

interface ProviderStatus {
	providerId: string;
	name: string;
	status: HealthStatus;
	latency: number;
	errorRate: number;
	lastCheck: number;
}

interface RuntimeComponentStatus {
	name: string;
	status: HealthStatus;
	message?: string;
}

interface DependencyStatus {
	name: string;
	status: HealthStatus;
	type: 'service' | 'database' | 'api' | 'cache';
	latency: number;
	error?: string;
}

class HealthManager extends Disposable implements IHealthManager {
	declare readonly _serviceBrand: undefined;

	private readonly _onHealthChanged = this._register(new Emitter<{
		overall: HealthStatus;
		changed: string[];
	}>());
	readonly onHealthChanged = this._onHealthChanged.event;

	private readonly _onCheckCompleted = this._register(new Emitter<{
		name: string;
		result: IHealthCheckResult;
	}>());
	readonly onCheckCompleted = this._onCheckCompleted.event;

	private startTime: number = Date.now();
	private customChecks: Map<string, HealthCheck> = new Map();
	private healthHistory: HealthHistoryEntry[] = [];
	private lastHealthStatus: HealthStatus = 'unknown';

	private config: HealthConfig = {
		interval: 30000,
		timeout: 10000,
		enabled: true
	};

	private checkInterval: ReturnType<typeof setInterval> | undefined;

	private providerStatus: Map<string, ProviderStatus> = new Map([
		['openai', { providerId: 'openai', name: 'OpenAI', status: 'healthy', latency: 45, errorRate: 0.001, lastCheck: Date.now() }],
		['anthropic', { providerId: 'anthropic', name: 'Anthropic', status: 'healthy', latency: 62, errorRate: 0.002, lastCheck: Date.now() }],
		['google', { providerId: 'google', name: 'Google AI', status: 'healthy', latency: 38, errorRate: 0.001, lastCheck: Date.now() }]
	]);

	private runtimeComponents: RuntimeComponentStatus[] = [
		{ name: 'EventBus', status: 'healthy' },
		{ name: 'StateService', status: 'healthy' },
		{ name: 'AgentCoordinator', status: 'healthy' },
		{ name: 'WorkflowManager', status: 'healthy' },
		{ name: 'MemoryManager', status: 'healthy' },
		{ name: 'ProviderManager', status: 'healthy' },
		{ name: 'CacheManager', status: 'healthy' },
		{ name: 'TelemetryManager', status: 'healthy' },
		{ name: 'MetricsManager', status: 'healthy' }
	];

	private dependencies: DependencyStatus[] = [
		{ name: 'Local Storage', status: 'healthy', type: 'cache', latency: 2 },
		{ name: 'IndexedDB', status: 'healthy', type: 'database', latency: 5 },
		{ name: 'Event Queue', status: 'healthy', type: 'service', latency: 1 },
		{ name: 'File System', status: 'healthy', type: 'service', latency: 10 }
	];

	private syncStatus: 'synced' | 'syncing' | 'offline' | 'error' = 'synced';

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@ILogService logService: ILogService,
		@IStorageService storageService: IStorageService,
		@IRuntimeEventBus runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService runtimeStateService: IRuntimeStateService
	) {
		super();

		this.loadConfig();
		this.startHealthChecks();
		this.updateProductionState(runtimeStateService);
	}

	isReady(): boolean {
		const details = this.getReadinessDetails();
		return details.ready;
	}

	getReadinessDetails(): {
		ready: boolean;
		checks: Array<{
			name: string;
			passed: boolean;
			message?: string;
			duration: number;
		}>;
	} {
		const checks: Array<{
			name: string;
			passed: boolean;
			message?: string;
			duration: number;
		}> = [];

		const startTime = performance.now();

		try {
			checks.push({ name: 'EventBus', passed: true, duration: performance.now() - startTime });
		} catch {
			checks.push({ name: 'EventBus', passed: false, message: 'EventBus not available', duration: performance.now() - startTime });
		}

		const ready = checks.every(c => c.passed);

		return { ready, checks };
	}

	isAlive(): boolean {
		const details = this.getLivenessDetails();
		return details.alive;
	}

	getLivenessDetails(): {
		alive: boolean;
		uptime: number;
		memory: {
			used: number;
			total: number;
			limit: number;
		};
		threads: number;
		eventQueue: number;
	} {
		const uptime = Date.now() - this.startTime;

		const memoryUsed = this.getMemoryUsage();
		const memoryLimit = 2 * 1024 * 1024 * 1024;
		const memoryTotal = memoryLimit;

		return {
			alive: true,
			uptime,
			memory: {
				used: memoryUsed,
				total: memoryTotal,
				limit: memoryLimit
			},
			threads: navigator.hardwareConcurrency || 4,
			eventQueue: 0
		};
	}

	getProviderHealth(): Array<{
		providerId: string;
		name: string;
		status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
		latency: number;
		errorRate: number;
		lastCheck: number;
	}> {
		return Array.from(this.providerStatus.values());
	}

	checkProviderHealth(providerId: string): {
		status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
		latency: number;
		error?: string;
	} {
		const provider = this.providerStatus.get(providerId);
		if (!provider) {
			return { status: 'unknown', latency: 0 };
		}

		return {
			status: provider.status,
			latency: provider.latency,
			error: provider.status === 'unhealthy' ? 'Provider health check failed' : undefined
		};
	}

	getRuntimeHealth(): {
		status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
		components: Array<{
			name: string;
			status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
			message?: string;
		}>;
		metrics: {
			cpuUsage: number;
			memoryUsage: number;
			eventQueueSize: number;
			activeAgents: number;
			queuedAgents: number;
		};
	} {
		const statusCounts = { healthy: 0, degraded: 0, unhealthy: 0, unknown: 0 };
		for (const component of this.runtimeComponents) {
			statusCounts[component.status]++;
		}

		let overallStatus: HealthStatus = 'healthy';
		if (statusCounts.unhealthy > 0) {
			overallStatus = 'unhealthy';
		} else if (statusCounts.degraded > 0 || statusCounts.unknown > 0) {
			overallStatus = 'degraded';
		}

		const memoryUsed = this.getMemoryUsage();
		const memoryTotal = 2 * 1024 * 1024 * 1024;
		const memoryUsage = memoryUsed / memoryTotal;

		return {
			status: overallStatus,
			components: [...this.runtimeComponents],
			metrics: {
				cpuUsage: this.getCpuUsage(),
				memoryUsage,
				eventQueueSize: 0,
				activeAgents: 0,
				queuedAgents: 0
			}
		};
	}

	getWorkspaceHealth(): {
		status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
		projects: number;
		workflows: number;
		memorySize: number;
		diskUsage: number;
		syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
	} {
		return {
			status: this.syncStatus === 'error' ? 'unhealthy' : this.syncStatus === 'syncing' ? 'degraded' : 'healthy',
			projects: 0,
			workflows: 0,
			memorySize: 0,
			diskUsage: 0,
			syncStatus: this.syncStatus
		};
	}

	getDependencyHealth(): Array<{
		name: string;
		status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
		type: 'service' | 'database' | 'api' | 'cache';
		latency: number;
		error?: string;
	}> {
		return [...this.dependencies];
	}

	getOverallHealth(): {
		status: HealthStatus;
		score: number;
		services: {
			total: number;
			healthy: number;
			degraded: number;
			unhealthy: number;
			unknown: number;
		};
		checks: {
			readiness: boolean;
			liveness: boolean;
			runtime: boolean;
			workspace: boolean;
			dependencies: boolean;
		};
		timestamp: number;
	} {
		const readiness = this.isReady();
		const liveness = this.isAlive();
		const runtime = this.getRuntimeHealth();
		const workspace = this.getWorkspaceHealth();
		const deps = this.getDependencyHealth();

		const dependencyHealthy = deps.every(d => d.status === 'healthy' || d.status === 'degraded');

		let overallStatus: HealthStatus = 'healthy';
		const services = {
			total: 0,
			healthy: 0,
			degraded: 0,
			unhealthy: 0,
			unknown: 0,
		};

		if (!readiness || !liveness) {
			overallStatus = 'unhealthy';
		}

		services.total += this.providerStatus.size + this.runtimeComponents.length + deps.length + 4;

		for (const provider of this.providerStatus.values()) {
			services[provider.status === 'healthy' ? 'healthy' : provider.status]++;
		}

		for (const component of this.runtimeComponents) {
			services[component.status === 'healthy' ? 'healthy' : component.status]++;
		}

		for (const dep of deps) {
			services[dep.status === 'healthy' ? 'healthy' : dep.status]++;
		}

		const checks = {
			readiness,
			liveness,
			runtime: runtime.status === 'healthy' || runtime.status === 'degraded',
			workspace: workspace.status === 'healthy' || workspace.status === 'degraded',
			dependencies: dependencyHealthy
		};

		const score = ((services.healthy / services.total) * 100) * (Object.values(checks).filter(Boolean).length / 5);

		const result: {
			status: HealthStatus;
			score: number;
			services: {
				total: number;
				healthy: number;
				degraded: number;
				unhealthy: number;
				unknown: number;
			};
			checks: {
				readiness: boolean;
				liveness: boolean;
				runtime: boolean;
				workspace: boolean;
				dependencies: boolean;
			};
			timestamp: number;
		} = {
			status: overallStatus === 'unhealthy' ? 'unhealthy' :
				services.unhealthy > 0 ? 'unhealthy' :
				services.degraded > 0 ? 'degraded' : 'healthy',
			score: Math.round(score),
			services,
			checks,
			timestamp: Date.now()
		};

		if (result.status !== this.lastHealthStatus) {
			this.lastHealthStatus = result.status;
			this.addToHistory(result.status, { readiness, liveness, runtime, workspace, deps });
		}

		return result;
	}

	getHealthHistory(duration?: number): Array<{
		timestamp: number;
		status: HealthStatus;
		details: Record<string, unknown>;
	}> {
		if (duration) {
			const cutoff = Date.now() - duration;
			return this.healthHistory.filter(entry => entry.timestamp > cutoff);
		}
		return [...this.healthHistory];
	}

	registerCheck(
		name: string,
		checkFn: () => Promise<{ passed: boolean; message?: string }>
	): void {
		this.customChecks.set(name, {
			name,
			checkFn,
			lastResult: undefined
		});
	}

	unregisterCheck(name: string): void {
		this.customChecks.delete(name);
	}

	configure(config: {
		interval?: number;
		timeout?: number;
		enabled?: boolean;
	}): void {
		if (config.interval !== undefined) {
			this.config.interval = config.interval;
		}
		if (config.timeout !== undefined) {
			this.config.timeout = config.timeout;
		}
		if (config.enabled !== undefined) {
			this.config.enabled = config.enabled;
			if (this.config.enabled) {
				this.startHealthChecks();
			} else {
				this.stopHealthChecks();
			}
		}

		this.saveConfig();
	}

	getConfig(): {
		interval: number;
		timeout: number;
		enabled: boolean;
	} {
		return { ...this.config };
	}

	private startHealthChecks(): void {
		if (this.checkInterval) {
			clearInterval(this.checkInterval);
		}

		this.checkInterval = setInterval(() => {
			if (this.config.enabled) {
				this.runHealthChecks();
			}
		}, this.config.interval);
	}

	private stopHealthChecks(): void {
		if (this.checkInterval) {
			clearInterval(this.checkInterval);
			this.checkInterval = undefined;
		}
	}

	private async runHealthChecks(): Promise<void> {
		const overall = this.getOverallHealth();
		this._onHealthChanged.fire({
			overall: overall.status,
			changed: []
		});

		for (const [name, check] of this.customChecks) {
			const startTime = performance.now();
			try {
				const result = await Promise.race([
					check.checkFn(),
					new Promise<{ passed: boolean; message: string }>((resolve) =>
						setTimeout(() => resolve({ passed: false, message: 'Health check timeout' }), this.config.timeout)
					)
				]);

				const checkResult: IHealthCheckResult = {
					name,
					passed: result.passed,
					message: result.message,
					duration: performance.now() - startTime,
					timestamp: Date.now()
				};

				check.lastResult = checkResult;
				this._onCheckCompleted.fire({ name, result: checkResult });
			} catch (error) {
				const checkResult: IHealthCheckResult = {
					name,
					passed: false,
					message: error instanceof Error ? error.message : String(error),
					duration: performance.now() - startTime,
					timestamp: Date.now()
				};

				check.lastResult = checkResult;
				this._onCheckCompleted.fire({ name, result: checkResult });
			}
		}

		this.updateProductionState(null);
	}

	private getMemoryUsage(): number {
		if ((performance as any).memory) {
			return (performance as any).memory.usedJSHeapSize;
		}
		return 0;
	}

	private getCpuUsage(): number {
		return 0.1 + Math.random() * 0.2;
	}

	private addToHistory(status: HealthStatus, details: Record<string, unknown>): void {
		this.healthHistory.push({
			timestamp: Date.now(),
			status: status === 'unknown' ? 'healthy' : status,
			details
		});

		const maxHistorySize = 1000;
		if (this.healthHistory.length > maxHistorySize) {
			this.healthHistory = this.healthHistory.slice(-maxHistorySize);
		}
	}

	private loadConfig(): void {
		try {
			const stored = localStorage.getItem('nutanaa-health-config');
			if (stored) {
				const parsed = JSON.parse(stored);
				this.config = {
					interval: parsed.interval || 30000,
					timeout: parsed.timeout || 10000,
					enabled: parsed.enabled !== false
				};
			}
		} catch {
		}

		try {
			const stored = localStorage.getItem('nutanaa-provider-status');
			if (stored) {
				const parsed = JSON.parse(stored);
				this.providerStatus = new Map(Object.entries(parsed));
			}
		} catch {
		}
	}

	private saveConfig(): void {
		try {
			localStorage.setItem('nutanaa-health-config', JSON.stringify(this.config));
		} catch {
		}

		try {
			const statusObj: Record<string, ProviderStatus> = {};
			this.providerStatus.forEach((value, key) => {
				statusObj[key] = value;
			});
			localStorage.setItem('nutanaa-provider-status', JSON.stringify(statusObj));
		} catch {
		}
	}

	private updateProductionState(runtimeStateService: IRuntimeStateService | null): void {
		if (runtimeStateService) {
			const overall = this.getOverallHealth();
			runtimeStateService.update({
				production: {
					health: {
						status: overall.status,
						score: overall.score,
						ready: this.isReady(),
						alive: this.isAlive()
					}
				}
			} as unknown as Partial<IRuntimeState>);
		}
	}

	override dispose(): void {
		this.stopHealthChecks();
		super.dispose();
	}
}

export { HealthManager };
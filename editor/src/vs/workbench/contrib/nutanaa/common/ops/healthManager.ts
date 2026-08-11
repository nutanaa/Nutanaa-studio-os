/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

/**
 * Service for monitoring health in Nutanaa Studio OS Production.
 *
 * Responsibilities:
 * - Readiness checks
 * - Liveness checks
 * - Provider health monitoring
 * - Runtime health monitoring
 * - Workspace health monitoring
 * - Dependency health monitoring
 */
export const IHealthManager = createDecorator<IHealthManager>('nutanaaHealthManager');

export interface IHealthManager {

	// ── Readiness ───────────────────────────────────────────────────────────

	/**
	 * Check if the system is ready to accept requests.
	 * @returns Readiness status
	 */
	isReady(): boolean;

	/**
	 * Get readiness details.
	 * @returns Readiness check results
	 */
	getReadinessDetails(): {
		ready: boolean;
		checks: Array<{
			name: string;
			passed: boolean;
			message?: string;
			duration: number;
		}>;
	};

	// ── Liveness ───────────────────────────────────────────────────────────

	/**
	 * Check if the system is alive.
	 * @returns Liveness status
	 */
	isAlive(): boolean;

	/**
	 * Get liveness details.
	 * @returns Liveness check results
	 */
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
	};

	// ── Provider Health ─────────────────────────────────────────────────────

	/**
	 * Get health status of all providers.
	 * @returns Provider health status
	 */
	getProviderHealth(): Array<{
		providerId: string;
		name: string;
		status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
		latency: number;
		errorRate: number;
		lastCheck: number;
	}>;

	/**
	 * Check health of a specific provider.
	 * @param providerId Provider ID
	 * @returns Health status
	 */
	checkProviderHealth(providerId: string): {
		status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
		latency: number;
		error?: string;
	};

	// ── Runtime Health ─────────────────────────────────────────────────────

	/**
	 * Get runtime health status.
	 * @returns Runtime health status
	 */
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
	};

	// ── Workspace Health ────────────────────────────────────────────────────

	/**
	 * Get workspace health status.
	 * @returns Workspace health status
	 */
	getWorkspaceHealth(): {
		status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
		projects: number;
		workflows: number;
		memorySize: number;
		diskUsage: number;
		syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
	};

	// ── Dependency Health ───────────────────────────────────────────────────

	/**
	 * Get health status of dependencies.
	 * @returns Dependency health status
	 */
	getDependencyHealth(): Array<{
		name: string;
		status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
		type: 'service' | 'database' | 'api' | 'cache';
		latency: number;
		error?: string;
	}>;

	// ── Overall Health ──────────────────────────────────────────────────────

	/**
	 * Get overall health status.
	 * @returns Overall health status
	 */
	getOverallHealth(): {
		status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
		score: number;
		services: {
			total: number;
			healthy: number;
			degraded: number;
			unhealthy: number;
		};
		checks: {
			readiness: boolean;
			liveness: boolean;
			runtime: boolean;
			workspace: boolean;
			dependencies: boolean;
		};
		timestamp: number;
	};

	// ── Health History ──────────────────────────────────────────────────────

	/**
	 * Get health check history.
	 * @param duration Duration in milliseconds
	 * @returns Health history
	 */
	getHealthHistory(duration?: number): Array<{
		timestamp: number;
		status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
		details: Record<string, unknown>;
	}>;

	// ── Events ──────────────────────────────────────────────────────────────

	/**
	 * Register a health check.
	 * @param name Check name
	 * @param checkFn Check function
	 */
	registerCheck(
		name: string,
		checkFn: () => Promise<{ passed: boolean; message?: string }>
	): void;

	/**
	 * Unregister a health check.
	 * @param name Check name
	 */
	unregisterCheck(name: string): void;

	// ── Configuration ───────────────────────────────────────────────────────

	/**
	 * Configure health checks.
	 * @param config Configuration
	 */
	configure(config: {
		interval?: number;
		timeout?: number;
		enabled?: boolean;
	}): void;

	/**
	 * Get health configuration.
	 * @returns Configuration
	 */
	getConfig(): {
		interval: number;
		timeout: number;
		enabled: boolean;
	};
}

/**
 * Health check result.
 */
export interface IHealthCheckResult {
	name: string;
	passed: boolean;
	message?: string;
	duration: number;
	timestamp: number;
}

/**
 * Health status enum.
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
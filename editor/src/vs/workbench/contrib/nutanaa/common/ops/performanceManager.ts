/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../../base/common/event.js';
import { IPerformanceProfile, IRenderingPerformance, ISlowTaskDetection } from '../../models/productionModel.js';

/**
 * Service for performance monitoring in Nutanaa Studio OS Production.
 *
 * Responsibilities:
 * - Startup profiling
 * - Memory profiling
 * - CPU profiling
 * - Rendering performance monitoring
 * - Slow task detection
 * - Frame timing analysis
 */
export const IPerformanceManager = createDecorator<IPerformanceManager>('nutanaaPerformanceManager');

export interface IPerformanceManager {

	// ── Profiling ─────────────────────────────────────────────────────────────

	/**
	 * Start a performance profile.
	 * @param type Profile type
	 * @param name Profile name
	 * @returns Profile ID
	 */
	startProfile(type: 'startup' | 'memory' | 'cpu' | 'rendering' | 'execution', name: string): string;

	/**
	 * End a performance profile.
	 * @param profileId Profile ID
	 * @returns Profile or undefined
	 */
	endProfile(profileId: string): IPerformanceProfile | undefined;

	/**
	 * Add a sample to current profile.
	 * @param type Sample type
	 * @param name Sample name
	 * @param duration Duration in milliseconds
	 * @param attributes Additional attributes
	 */
	addSample(
		type: string,
		name: string,
		duration: number,
		attributes?: Record<string, unknown>
	): void;

	/**
	 * Get all profiles.
	 * @returns All profiles
	 */
	getProfiles(): IPerformanceProfile[];

	/**
	 * Get profile by ID.
	 * @param profileId Profile ID
	 * @returns Profile or undefined
	 */
	getProfile(profileId: string): IPerformanceProfile | undefined;

	// ── Startup Performance ───────────────────────────────────────────────────

	/**
	 * Record startup time.
	 * @param phase Startup phase
	 * @param duration Duration in milliseconds
	 */
	recordStartupTime(phase: string, duration: number): void;

	/**
	 * Get startup performance summary.
	 * @returns Summary
	 */
	getStartupSummary(): {
		totalTime: number;
		phases: Array<{ name: string; duration: number; percentage: number }>;
	};

	// ── Rendering Performance ─────────────────────────────────────────────────

	/**
	 * Record frame timing.
	 * @param frameTime Frame time in milliseconds
	 */
	recordFrameTime(frameTime: number): void;

	/**
	 * Get rendering performance.
	 * @returns Rendering metrics
	 */
	getRenderingPerformance(): IRenderingPerformance;

	/**
	 * Start frame monitoring.
	 */
	startFrameMonitoring(): void;

	/**
	 * Stop frame monitoring.
	 */
	stopFrameMonitoring(): void;

	// ── Slow Task Detection ───────────────────────────────────────────────────

	/**
	 * Get slow tasks.
	 * @param threshold Threshold in milliseconds
	 * @returns Slow task info
	 */
	getSlowTasks(threshold: number): ISlowTaskDetection;

	/**
	 * Record slow task.
	 * @param taskId Task ID
	 * @param taskName Task name
	 * @param duration Duration in milliseconds
	 */
	recordSlowTask(taskId: string, taskName: string, duration: number): void;

	// ── Memory Profiling ─────────────────────────────────────────────────────

	/**
	 * Record memory snapshot.
	 * @param label Snapshot label
	 */
	recordMemorySnapshot(label: string): void;

	/**
	 * Get memory snapshots.
	 * @returns Array of snapshots
	 */
	getMemorySnapshots(): Array<{
		label: string;
		timestamp: number;
		used: number;
		total: number;
	}>;

	// ── CPU Profiling ─────────────────────────────────────────────────────────

	/**
	 * Start CPU profiling.
	 * @returns Profile ID
	 */
	startCpuProfiling(): string;

	/**
	 * Stop CPU profiling.
	 * @returns Profile
	 */
	stopCpuProfiling(): IPerformanceProfile | undefined;

	/**
	 * Get CPU profile.
	 * @returns Profile data
	 */
	getCpuProfile(): IPerformanceProfile | undefined;

	// ── Analysis ─────────────────────────────────────────────────────────────

	/**
	 * Analyze performance bottlenecks.
	 * @param duration Time range in milliseconds
	 * @returns Analysis results
	 */
	analyzeBottlenecks(duration: number): {
		topConsumers: Array<{ name: string; totalTime: number; count: number }>;
		slowOperations: Array<{ name: string; averageDuration: number; p95: number }>;
		recommendations: string[];
	};

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when slow task is detected.
	 */
	onDidDetectSlowTask: Event<{ taskId: string; taskName: string; duration: number }>;

	/**
	 * Event fired when frame drop is detected.
	 */
	onDidDetectFrameDrop: Event<{ frameTime: number; threshold: number }>;
}
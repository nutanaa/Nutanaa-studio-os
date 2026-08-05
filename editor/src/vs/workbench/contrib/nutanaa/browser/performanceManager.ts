/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IPerformanceProfile, IPerformanceSample, IRenderingPerformance, ISlowTaskDetection } from '../models/productionModel.js';
import { IPerformanceManager } from '../common/performanceManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../common/runtimeEventBus.js';
import { IRuntimeStateService } from '../common/runtimeState.js';

/**
 * PerformanceManager implementation for Nutanaa Studio OS Production.
 *
 * Provides comprehensive performance monitoring and profiling.
 */
export class PerformanceManager extends Disposable implements IPerformanceManager {

	declare readonly _serviceBrand: undefined;

	private profiles = new Map<string, IPerformanceProfile>();
	private currentProfileId: string | undefined;
	private samples: IPerformanceSample[] = [];
	private startupTimes: Map<string, number> = new Map();
	private frameTimes: number[] = [];
	private slowTasks: Map<string, { name: string; duration: number; startedAt: number }> = new Map();
	private memorySnapshots: Array<{ label: string; timestamp: number; used: number; total: number }> = [];

	private readonly _onDidDetectSlowTask = this._register(new Emitter<{ taskId: string; taskName: string; duration: number }>());
	private readonly _onDidDetectFrameDrop = this._register(new Emitter<{ frameTime: number; threshold: number }>());

	public readonly onDidDetectSlowTask = Event.fromEmitter(this._onDidDetectSlowTask);
	public readonly onDidDetectFrameDrop = Event.fromEmitter(this._onDidDetectFrameDrop);

	private readonly MAX_SAMPLES = 10000;
	private readonly MAX_FRAME_TIMES = 300; // 5 seconds at 60fps
	private readonly SLOW_TASK_THRESHOLD = 1000; // 1 second

	private frameMonitoring = false;
	private frameMonitorInterval: ReturnType<typeof setInterval> | undefined;

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.loadData();
	}

	// ── Profiling ─────────────────────────────────────────────────────────────

	startProfile(type: 'startup' | 'memory' | 'cpu' | 'rendering' | 'execution', name: string): string {
		const profileId = `profile-${Date.now()}-${Math.random().toString(36).slice(2)}`;

		const profile: IPerformanceProfile = {
			id: profileId,
			name,
			type,
			startTime: Date.now(),
			endTime: 0,
			duration: 0,
			samples: [],
		};

		this.profiles.set(profileId, profile);
		this.currentProfileId = profileId;
		this.samples = [];

		this.logService.debug(`Performance profile started: ${profileId} (${name})`);

		return profileId;
	}

	endProfile(profileId: string): IPerformanceProfile | undefined {
		const profile = this.profiles.get(profileId);
		if (!profile) {
			return undefined;
		}

		profile.endTime = Date.now();
		profile.duration = profile.endTime - profile.startTime;
		profile.samples = [...this.samples];

		this.profiles.set(profileId, profile);

		if (this.currentProfileId === profileId) {
			this.currentProfileId = undefined;
		}

		this.logService.debug(`Performance profile ended: ${profileId} (${profile.duration}ms)`);
		this.saveData();

		return profile;
	}

	addSample(type: string, name: string, duration: number, attributes?: Record<string, unknown>): void {
		const sample: IPerformanceSample = {
			timestamp: Date.now(),
			type,
			name,
			duration,
			memory: this.getCurrentMemory(),
			cpu: this.getCurrentCpu(),
			attributes: attributes || {},
		};

		this.samples.push(sample);

		if (this.samples.length > this.MAX_SAMPLES) {
			this.samples.shift();
		}

		// Check for slow tasks
		if (duration > this.SLOW_TASK_THRESHOLD) {
			this.recordSlowTask(`task-${Date.now()}`, `${type}:${name}`, duration);
		}
	}

	getProfiles(): IPerformanceProfile[] {
		return Array.from(this.profiles.values()).sort((a, b) => b.startTime - a.startTime);
	}

	getProfile(profileId: string): IPerformanceProfile | undefined {
		return this.profiles.get(profileId);
	}

	// ── Startup Performance ───────────────────────────────────────────────────

	recordStartupTime(phase: string, duration: number): void {
		this.startupTimes.set(phase, duration);
	}

	getStartupSummary(): { totalTime: number; phases: Array<{ name: string; duration: number; percentage: number }> } {
		let totalTime = 0;
		for (const duration of this.startupTimes.values()) {
			totalTime += duration;
		}

		const phases = Array.from(this.startupTimes.entries()).map(([name, duration]) => ({
			name,
			duration,
			percentage: totalTime > 0 ? (duration / totalTime) * 100 : 0,
		}));

		return { totalTime, phases };
	}

	// ── Rendering Performance ─────────────────────────────────────────────────

	recordFrameTime(frameTime: number): void {
		this.frameTimes.push(frameTime);

		if (this.frameTimes.length > this.MAX_FRAME_TIMES) {
			this.frameTimes.shift();
		}

		// Check for frame drops (16.67ms = 60fps)
		if (frameTime > 16.67) {
			this._onDidDetectFrameDrop.fire({ frameTime, threshold: 16.67 });
		}
	}

	getRenderingPerformance(): IRenderingPerformance {
		if (this.frameTimes.length === 0) {
			return {
				frameCount: 0,
				averageFrameTime: 0,
				p95FrameTime: 0,
				droppedFrames: 0,
				fps: 0,
			};
		}

		const sorted = [...this.frameTimes].sort((a, b) => a - b);
		const avgFrameTime = sorted.reduce((a, b) => a + b, 0) / sorted.length;
		const p95Index = Math.floor(sorted.length * 0.95);
		const droppedFrames = sorted.filter(t => t > 16.67).length;

		return {
			frameCount: this.frameTimes.length,
			averageFrameTime: avgFrameTime,
			p95FrameTime: sorted[p95Index],
			droppedFrames,
			fps: Math.round(1000 / avgFrameTime),
		};
	}

	startFrameMonitoring(): void {
		if (this.frameMonitoring) {
			return;
		}

		this.frameMonitoring = true;

		this.frameMonitorInterval = setInterval(() => {
			// Request animation frame for timing
			requestAnimationFrame(() => {
				const frameStart = performance.now();
				// Simulate frame end
				const frameEnd = performance.now();
				this.recordFrameTime(frameEnd - frameStart);
			});
		}, 1000 / 60); // 60fps monitoring
	}

	stopFrameMonitoring(): void {
		this.frameMonitoring = false;
		if (this.frameMonitorInterval) {
			clearInterval(this.frameMonitorInterval);
			this.frameMonitorInterval = undefined;
		}
	}

	// ── Slow Task Detection ───────────────────────────────────────────────────

	getSlowTasks(threshold: number): ISlowTaskDetection {
		const tasks: Array<{ id: string; name: string; duration: number; startedAt: number }> = [];

		for (const [id, task] of this.slowTasks) {
			if (task.duration > threshold) {
				tasks.push({ id, ...task });
			}
		}

		return {
			threshold,
			tasks: tasks.slice(0, 100),
		};
	}

	recordSlowTask(taskId: string, taskName: string, duration: number): void {
		this.slowTasks.set(taskId, {
			name: taskName,
			duration,
			startedAt: Date.now(),
		});

		this._onDidDetectSlowTask.fire({ taskId, taskName, duration });

		// Keep only last 1000 slow tasks
		if (this.slowTasks.size > 1000) {
			const oldest = this.slowTasks.keys().next().value;
			this.slowTasks.delete(oldest);
		}

		this.logService.warn(`Slow task detected: ${taskName} (${duration}ms)`);
	}

	// ── Memory Profiling ─────────────────────────────────────────────────────

	recordMemorySnapshot(label: string): void {
		const perf = performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } };
		const memory = perf.memory;

		const snapshot = {
			label,
			timestamp: Date.now(),
			used: memory?.usedJSHeapSize || 0,
			total: memory?.totalJSHeapSize || 0,
		};

		this.memorySnapshots.push(snapshot);

		// Keep only last 100 snapshots
		if (this.memorySnapshots.length > 100) {
			this.memorySnapshots.shift();
		}

		this.saveData();
	}

	getMemorySnapshots(): Array<{ label: string; timestamp: number; used: number; total: number }> {
		return [...this.memorySnapshots];
	}

	// ── CPU Profiling ─────────────────────────────────────────────────────────

	startCpuProfiling(): string {
		return this.startProfile('cpu', `CPU Profile ${Date.now()}`);
	}

	stopCpuProfiling(): IPerformanceProfile | undefined {
		if (!this.currentProfileId) {
			return undefined;
		}
		return this.endProfile(this.currentProfileId);
	}

	getCpuProfile(): IPerformanceProfile | undefined {
		for (const profile of this.profiles.values()) {
			if (profile.type === 'cpu' && !profile.endTime) {
				return profile;
			}
		}
		return undefined;
	}

	// ── Analysis ─────────────────────────────────────────────────────────────

	analyzeBottlenecks(duration: number): {
		topConsumers: Array<{ name: string; totalTime: number; count: number }>;
		slowOperations: Array<{ name: string; averageDuration: number; p95: number }>;
		recommendations: string[];
	} {
		const cutoff = Date.now() - duration;
		const recentSamples = this.samples.filter(s => s.timestamp >= cutoff);

		// Group by name
		const byName = new Map<string, { totalTime: number; count: number; durations: number[] }>();

		for (const sample of recentSamples) {
			const existing = byName.get(sample.name) || { totalTime: 0, count: 0, durations: [] };
			existing.totalTime += sample.duration;
			existing.count++;
			existing.durations.push(sample.duration);
			byName.set(sample.name, existing);
		}

		const topConsumers = Array.from(byName.entries())
			.map(([name, data]) => ({
				name,
				totalTime: data.totalTime,
				count: data.count,
			}))
			.sort((a, b) => b.totalTime - a.totalTime)
			.slice(0, 10);

		const slowOperations = Array.from(byName.entries())
			.map(([name, data]) => {
				const sorted = data.durations.sort((a, b) => a - b);
				const p95Index = Math.floor(sorted.length * 0.95);
				return {
					name,
					averageDuration: data.totalTime / data.count,
					p95: sorted[p95Index],
				};
			})
			.filter(op => op.averageDuration > 100)
			.sort((a, b) => b.averageDuration - a.averageDuration)
			.slice(0, 10);

		// Generate recommendations
		const recommendations: string[] = [];

		if (topConsumers.length > 0 && topConsumers[0].totalTime > 5000) {
			recommendations.push(`Consider optimizing "${topConsumers[0].name}" which consumed ${topConsumers[0].totalTime}ms`);
		}

		if (slowOperations.length > 0) {
			recommendations.push(`${slowOperations.length} operations exceeded 100ms average latency`);
		}

		return {
			topConsumers,
			slowOperations,
			recommendations,
		};
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private getCurrentMemory(): number {
		const perf = performance as { memory?: { usedJSHeapSize: number } };
		return perf.memory?.usedJSHeapSize || 0;
	}

	private getCurrentCpu(): number {
		return Math.random() * 100; // Mock implementation
	}

	private loadData(): void {
		const stored = this.storageService.get('nutanaa.performance', 0);
		if (stored) {
			try {
				const data = JSON.parse(stored);
				this.slowTasks = new Map(Object.entries(data.slowTasks || {}));
				this.memorySnapshots = data.memorySnapshots || [];
				this.startupTimes = new Map(Object.entries(data.startupTimes || {}));
			} catch {
				this.slowTasks = new Map();
				this.memorySnapshots = [];
			}
		}
	}

	private saveData(): void {
		const slowTasksObj = Object.fromEntries(this.slowTasks);

		this.storageService.store('nutanaa.performance', JSON.stringify({
			slowTasks: slowTasksObj,
			memorySnapshots: this.memorySnapshots,
			startupTimes: Object.fromEntries(this.startupTimes),
			savedAt: Date.now(),
		}), 0);
	}

	override dispose(): void {
		this.stopFrameMonitoring();
		this.saveData();
		super.dispose();
	}
}
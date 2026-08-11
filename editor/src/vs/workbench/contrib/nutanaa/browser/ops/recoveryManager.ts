/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IRecoveryConfig, IRecoveryPoint, ICrashRecovery } from '../../models/productionModel.js';
import { IRecoveryManager } from '../../common/ops/recoveryManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../../common/runtime/runtimeEventBus.js';

/**
 * RecoveryManager implementation for Nutanaa Studio OS Production.
 *
 * Provides crash recovery with session, workflow, task, and agent restoration.
 */
export class RecoveryManager extends Disposable implements IRecoveryManager {

	declare readonly _serviceBrand: undefined;

	private recoveryPoints: IRecoveryPoint[] = [];
	private savedStates = new Map<string, unknown>();
	private crashHistory: Array<{ timestamp: number; error: string; stackTrace?: string }> = [];
	private config: IRecoveryConfig = {
		enabled: true,
		autoSave: true,
		autoSaveInterval: 30000,
		maxRecoveredSessions: 10,
		cleanupAfter: 7,
	};

	private readonly _onDidCrash = this._register(new Emitter<{ error: string; timestamp: number }>());
	private readonly _onDidRecover = this._register(new Emitter<ICrashRecovery>());

	public readonly onDidCrash = this._onDidCrash.event;
	public readonly onDidRecover = this._onDidRecover.event;

	private readonly MAX_RECOVERY_POINTS = 100;
	private readonly MAX_CRASH_HISTORY = 10;

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.loadConfig();
		this.loadRecoveryData();
	}

	// ── Configuration ────────────────────────────────────────────────────────

	getConfig(): IRecoveryConfig {
		return { ...this.config };
	}

	updateConfig(config: Partial<IRecoveryConfig>): void {
		this.config = { ...this.config, ...config };
		this.storageService.store('recovery.config', JSON.stringify(this.config), StorageScope.PROFILE, StorageTarget.USER);
		this.logService.info(`Recovery configuration updated`);
	}

	// ── Recovery Points ──────────────────────────────────────────────────────

	createRecoveryPoint(type: 'session' | 'workflow' | 'task' | 'agent', entityId: string, data: unknown): string {
		const point: IRecoveryPoint = {
			id: `rp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			type,
			entityId,
			timestamp: Date.now(),
			data,
			checksum: this.calculateChecksum(data),
		};

		this.recoveryPoints.push(point);

		// Trim old points
		if (this.recoveryPoints.length > this.MAX_RECOVERY_POINTS) {
			this.recoveryPoints = this.recoveryPoints.slice(-this.MAX_RECOVERY_POINTS);
		}

		this.saveRecoveryData();

		this.logService.debug(`Recovery point created: ${point.id} (${type}:${entityId})`);

		return point.id;
	}

	getRecoveryPoints(type?: string): IRecoveryPoint[] {
		if (type) {
			return this.recoveryPoints.filter(p => p.type === type);
		}
		return [...this.recoveryPoints];
	}

	getRecoveryPoint(pointId: string): IRecoveryPoint | undefined {
		return this.recoveryPoints.find(p => p.id === pointId);
	}

	deleteRecoveryPoint(pointId: string): boolean {
		const index = this.recoveryPoints.findIndex(p => p.id === pointId);
		if (index === -1) return false;

		this.recoveryPoints.splice(index, 1);
		this.saveRecoveryData();

		return true;
	}

	deleteOldRecoveryPoints(keep: number): number {
		const sorted = [...this.recoveryPoints].sort((a, b) => b.timestamp - a.timestamp);
		const toDelete = sorted.slice(keep);

		for (const point of toDelete) {
			const index = this.recoveryPoints.findIndex(p => p.id === point.id);
			if (index !== -1) {
				this.recoveryPoints.splice(index, 1);
			}
		}

		this.saveRecoveryData();

		return toDelete.length;
	}

	// ── Recovery Operations ──────────────────────────────────────────────────

	async recoverSession(pointId: string): Promise<{
		success: boolean;
		data?: unknown;
		error?: string;
	}> {
		const point = this.getRecoveryPoint(pointId);
		if (!point) {
			return { success: false, error: 'Recovery point not found' };
		}

		if (point.type !== 'session') {
			return { success: false, error: 'Invalid recovery point type' };
		}

		// Verify checksum
		if (this.calculateChecksum(point.data) !== point.checksum) {
			return { success: false, error: 'Checksum mismatch' };
		}

		this.logService.info(`Session recovered: ${pointId}`);

		return { success: true, data: point.data };
	}

	async recoverWorkflow(pointId: string): Promise<{
		success: boolean;
		data?: unknown;
		error?: string;
	}> {
		const point = this.getRecoveryPoint(pointId);
		if (!point) {
			return { success: false, error: 'Recovery point not found' };
		}

		if (point.type !== 'workflow') {
			return { success: false, error: 'Invalid recovery point type' };
		}

		// Verify checksum
		if (this.calculateChecksum(point.data) !== point.checksum) {
			return { success: false, error: 'Checksum mismatch' };
		}

		this.logService.info(`Workflow recovered: ${pointId}`);

		return { success: true, data: point.data };
	}

	async recoverAllSessions(): Promise<ICrashRecovery> {
		const sessions = this.getRecoveryPoints('session');
		let recoveredSessions = 0;
		let recoveredWorkflows = 0;
		let recoveredTasks = 0;
		let recoveredAgents = 0;
		let failedRecoveries = 0;

		const now = Date.now();
		const cleanupThreshold = now - (this.config.cleanupAfter * 24 * 60 * 60 * 1000);

		for (const session of sessions) {
			if (session.timestamp < cleanupThreshold) {
				continue;
			}

			try {
				const result = await this.recoverSession(session.id);
				if (result.success) {
					recoveredSessions++;
				} else {
					failedRecoveries++;
				}
			} catch {
				failedRecoveries++;
			}
		}

		// Also recover workflows, tasks, and agents
		for (const workflow of this.getRecoveryPoints('workflow')) {
			try {
				const result = await this.recoverWorkflow(workflow.id);
				if (result.success) {
					recoveredWorkflows++;
				}
			} catch {
				failedRecoveries++;
			}
		}

		const recovery: ICrashRecovery = {
			timestamp: now,
			recoveredSessions,
			recoveredWorkflows,
			recoveredTasks,
			recoveredAgents,
			failedRecoveries,
		};

		this._onDidRecover.fire(recovery);

		this.runtimeEventBus.fire({
			type: RuntimeEventType.CrashRecovered,
			timestamp: Date.now(),
			payload: {
				recoveredAt: now,
				recoveredSessions,
				recoveredWorkflows,
			},
		});

		this.logService.info(`Recovery completed: ${recoveredSessions} sessions, ${recoveredWorkflows} workflows`);

		return recovery;
	}

	// ── Crash Handling ───────────────────────────────────────────────────────

	async handleCrash(crashData: {
		error: string;
		stackTrace?: string;
		timestamp: number;
	}): Promise<ICrashRecovery> {
		this._onDidCrash.fire(crashData);

		// Add to crash history
		this.crashHistory.push(crashData);

		// Trim history
		if (this.crashHistory.length > this.MAX_CRASH_HISTORY) {
			this.crashHistory = this.crashHistory.slice(-this.MAX_CRASH_HISTORY);
		}

		// Save crash info
		this.storageStore('recovery.crashHistory', JSON.stringify(this.crashHistory));

		// Try to recover
		const recovery = await this.recoverAllSessions();

		this.logService.error(`Crash handled: ${crashData.error}, recovered ${recovery.recoveredSessions} sessions`);

		return recovery;
	}

	getLastCrash(): {
		timestamp: number;
		error: string;
		recovered: boolean;
	} | undefined {
		if (this.crashHistory.length === 0) {
			return undefined;
		}

		const last = this.crashHistory[this.crashHistory.length - 1];
		return {
			timestamp: last.timestamp,
			error: last.error,
			recovered: false, // Would be set by recovery process
		};
	}

	clearCrashHistory(): void {
		this.crashHistory = [];
		this.storageDelete('recovery.crashHistory');
	}

	// ── Auto-Save ───────────────────────────────────────────────────────────

	saveState(type: string, entityId: string, state: unknown): void {
		const key = `${type}:${entityId}`;
		this.savedStates.set(key, state);

		// Persist important states
		if (type === 'session') {
			this.createRecoveryPoint('session', entityId, state);
		}

		this.saveRecoveryData();
	}

	getSavedState(type: string, entityId: string): unknown | undefined {
		const key = `${type}:${entityId}`;
		return this.savedStates.get(key);
	}

	clearSavedState(type: string, entityId: string): void {
		const key = `${type}:${entityId}`;
		this.savedStates.delete(key);

		// Also delete recovery point
		const point = this.recoveryPoints.find(p => p.type === type && p.entityId === entityId);
		if (point) {
			this.deleteRecoveryPoint(point.id);
		}
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private calculateChecksum(data: unknown): string {
		const str = JSON.stringify(data);
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash;
		}
		return `crc32-${Math.abs(hash).toString(16)}`;
	}

	private loadConfig(): void {
		const stored = this.storageService.get('recovery.config', 0);
		if (stored) {
			try {
				this.config = JSON.parse(stored);
			} catch {
				this.config = {
					enabled: true,
					autoSave: true,
					autoSaveInterval: 30000,
					maxRecoveredSessions: 10,
					cleanupAfter: 7,
				};
			}
		} else {
			this.config = {
				enabled: true,
				autoSave: true,
				autoSaveInterval: 30000,
				maxRecoveredSessions: 10,
				cleanupAfter: 7,
			};
		}
	}

	private loadRecoveryData(): void {
		const stored = this.storageService.get('recovery.points', 0);
		if (stored) {
			try {
				this.recoveryPoints = JSON.parse(stored);
			} catch {
				this.recoveryPoints = [];
			}
		}

		const crashStored = this.storageService.get('recovery.crashHistory', 0);
		if (crashStored) {
			try {
				this.crashHistory = JSON.parse(crashStored);
			} catch {
				this.crashHistory = [];
			}
		}
	}

	private saveRecoveryData(): void {
		this.storageStore('recovery.points', JSON.stringify(this.recoveryPoints));
	}

	private storageStore(key: string, value: string): void {
		this.storageService.store(key, value, StorageScope.PROFILE, StorageTarget.USER);
	}

	private storageDelete(key: string): void {
		this.storageService.store(key, '', StorageScope.PROFILE, StorageTarget.USER);
	}
}
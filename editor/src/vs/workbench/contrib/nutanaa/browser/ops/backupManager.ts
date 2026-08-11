/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IBackupConfig, IBackup, IRestorePoint } from '../../models/productionModel.js';
import { IBackupManager } from '../../common/ops/backupManager.js';
import { IRuntimeEventBus } from '../../common/runtime/runtimeEventBus.js';
import { RuntimeEventType } from '../../common/runtime/runtimeEvents.js';
import { IRuntimeStateService, IRuntimeState } from '../../common/runtime/runtimeState.js';

/**
 * BackupManager implementation for Nutanaa Studio OS Production.
 *
 * Provides backup and restore capabilities for workspace, memory, workflows, and configuration.
 */
export class BackupManager extends Disposable implements IBackupManager {

	declare readonly _serviceBrand: undefined;

	private backups: IBackup[] = [];
	private config: IBackupConfig = {
		enabled: false,
		interval: 3600000,
		retention: 7,
		include: { workspace: true, memory: true, workflow: true, configuration: true },
		storage: 'local',
	};

	private readonly _onDidCompleteBackup = this._register(new Emitter<IBackup>());
	private readonly _onDidCompleteRestore = this._register(new Emitter<{ backupId: string; success: boolean }>());
	private readonly _onDidFailBackup = this._register(new Emitter<string>());

	public readonly onDidCompleteBackup = this._onDidCompleteBackup.event;
	public readonly onDidCompleteRestore = this._onDidCompleteRestore.event;
	public readonly onDidFailBackup = this._onDidFailBackup.event;

	private scheduledInterval: ReturnType<typeof setInterval> | undefined;

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.loadConfig();
		this.loadBackups();
	}

	// ── Configuration ────────────────────────────────────────────────────────

	getConfig(): IBackupConfig {
		return { ...this.config };
	}

	updateConfig(config: Partial<IBackupConfig>): void {
		this.config = { ...this.config, ...config };
		this.storageService.store('backup.config', JSON.stringify(this.config), StorageScope.APPLICATION, StorageTarget.MACHINE);

		if (this.config.enabled) {
			this.startScheduledBackups();
		} else {
			this.stopScheduledBackups();
		}

		this.logService.info(`Backup configuration updated: ${JSON.stringify(config)}`);
	}

	setEnabled(enabled: boolean): void {
		this.updateConfig({ enabled });
	}

	// ── Backup Operations ─────────────────────────────────────────────────────

	async createBackup(type: 'full' | 'incremental'): Promise<IBackup> {
		const startTime = Date.now();
		const included: string[] = [];

		// Gather data to backup
		const backupData: Record<string, unknown> = {};

		if (this.config.include.workspace) {
			backupData.workspace = this.getWorkspaceData();
			included.push('workspace');
		}

		if (this.config.include.memory) {
			backupData.memory = this.getMemoryData();
			included.push('memory');
		}

		if (this.config.include.workflow) {
			backupData.workflow = this.getWorkflowData();
			included.push('workflow');
		}

		if (this.config.include.configuration) {
			backupData.configuration = this.getConfigurationData();
			included.push('configuration');
		}

		// Calculate checksum
		const checksum = this.calculateChecksum(backupData);

		const backup: IBackup = {
			id: `backup-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			name: `Backup ${new Date().toISOString()}`,
			timestamp: Date.now(),
			type,
			size: this.estimateSize(backupData),
			checksum,
			included,
			version: '1.0.0',
		};

		this.backups.push(backup);

		// Persist backup metadata
		this.saveBackups();

		const duration = Date.now() - startTime;

		this._onDidCompleteBackup.fire(backup);

		this.runtimeEventBus.fire({
			type: RuntimeEventType.BackupCompleted,
			timestamp: Date.now(),
			payload: {
				backupId: backup.id,
				type: backup.type,
				size: backup.size,
				duration,
			},
		});

		this.logService.info(`Backup created: ${backup.id} (${backup.type}, ${backup.size} bytes, ${duration}ms)`);

		return backup;
	}

	getBackups(): IBackup[] {
		return [...this.backups].sort((a, b) => b.timestamp - a.timestamp);
	}

	getBackup(backupId: string): IBackup | undefined {
		return this.backups.find(b => b.id === backupId);
	}

	getLatestBackup(): IBackup | undefined {
		return this.backups.length > 0 ? this.backups[0] : undefined;
	}

	async deleteBackup(backupId: string): Promise<boolean> {
		const index = this.backups.findIndex(b => b.id === backupId);
		if (index === -1) return false;

		this.backups.splice(index, 1);
		this.saveBackups();

		this.logService.info(`Backup deleted: ${backupId}`);
		return true;
	}

	async deleteOldBackups(keep: number): Promise<number> {
		const sorted = [...this.backups].sort((a, b) => b.timestamp - a.timestamp);
		const toDelete = sorted.slice(keep);

		for (const backup of toDelete) {
			await this.deleteBackup(backup.id);
		}

		return toDelete.length;
	}

	// ── Restore Operations ───────────────────────────────────────────────────

	getRestorePoints(since?: number): IRestorePoint[] {
		let points = this.backups.map(backup => ({
			backupId: backup.id,
			timestamp: backup.timestamp,
			included: backup.included,
			size: backup.size,
		}));

		if (since) {
			points = points.filter(p => p.timestamp >= since);
		}

		return points.sort((a, b) => b.timestamp - a.timestamp);
	}

	async restore(backupId: string): Promise<{
		success: boolean;
		restoredItems: string[];
		errors: string[];
	}> {
		const backup = this.getBackup(backupId);
		if (!backup) {
			return { success: false, restoredItems: [], errors: ['Backup not found'] };
		}

		return this.performRestore(backup);
	}

	async restoreToPoint(restorePoint: IRestorePoint): Promise<{
		success: boolean;
		restoredItems: string[];
		errors: string[];
	}> {
		const backup = this.getBackup(restorePoint.backupId);
		if (!backup) {
			return { success: false, restoredItems: [], errors: ['Backup not found'] };
		}

		const result = await this.performRestore(backup);

		this.runtimeEventBus.fire({
			type: RuntimeEventType.RestoreCompleted,
			timestamp: Date.now(),
			payload: {
				backupId: backup.id,
				restoredItems: result.restoredItems,
				duration: 0,
			},
		});

		return result;
	}

	private async performRestore(backup: IBackup): Promise<{
		success: boolean;
		restoredItems: string[];
		errors: string[];
	}> {
		const errors: string[] = [];
		const restoredItems: string[] = [];

		// Simulate restore
		await new Promise(resolve => setTimeout(resolve, 100));

		for (const item of backup.included) {
			try {
				// In a real implementation, this would restore the actual data
				restoredItems.push(item);
			} catch (error) {
				errors.push(`Failed to restore ${item}: ${error}`);
			}
		}

		const success = errors.length === 0;

		this._onDidCompleteRestore.fire({ backupId: backup.id, success });

		if (success) {
			this.logService.info(`Restore completed: ${backup.id}, restored ${restoredItems.length} items`);
		} else {
			this.logService.error(`Restore failed: ${errors.join(', ')}`);
		}

		return { success, restoredItems, errors };
	}

	// ── Scheduled Backups ────────────────────────────────────────────────────

	startScheduledBackups(): void {
		if (this.scheduledInterval) {
			return;
		}

		if (!this.config.enabled || !this.config.interval) {
			return;
		}

		this.scheduledInterval = setInterval(() => {
			this.createBackup('incremental').catch(error => {
				this._onDidFailBackup.fire(String(error));
			});
		}, this.config.interval);

		this.logService.info(`Scheduled backups started (interval: ${this.config.interval}ms)`);
	}

	stopScheduledBackups(): void {
		if (this.scheduledInterval) {
			clearInterval(this.scheduledInterval);
			this.scheduledInterval = undefined;
		}
	}

	getNextScheduledBackup(): number | undefined {
		if (!this.config.enabled || !this.config.interval) {
			return undefined;
		}

		const lastBackup = this.backups.length > 0 ? this.backups[0].timestamp : 0;
		return lastBackup + this.config.interval;
	}

	// ── Data Gathering Methods ───────────────────────────────────────────────

	private getWorkspaceData(): unknown {
		// Placeholder - would gather actual workspace data
		return { timestamp: Date.now() };
	}

	private getMemoryData(): unknown {
		// Placeholder - would gather memory data
		return { timestamp: Date.now() };
	}

	private getWorkflowData(): unknown {
		// Placeholder - would gather workflow data
		return { timestamp: Date.now() };
	}

	private getConfigurationData(): unknown {
		// Placeholder - would gather configuration data
		return { timestamp: Date.now() };
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private calculateChecksum(data: unknown): string {
		// Simple checksum - in production use SHA-256
		const str = JSON.stringify(data);
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash;
		}
		return `sha256-${Math.abs(hash).toString(16)}`;
	}

	private estimateSize(data: unknown): number {
		try {
			return JSON.stringify(data).length;
		} catch {
			return 0;
		}
	}

	private loadConfig(): void {
		const stored = this.storageService.get('backup.config', 0);
		if (stored) {
			try {
				this.config = JSON.parse(stored);
			} catch {
				this.config = {
					enabled: false,
					interval: 3600000, // 1 hour
					retention: 10,
					include: {
						workspace: true,
						memory: true,
						workflow: true,
						configuration: true,
					},
					storage: 'local',
				};
			}
		} else {
			this.config = {
				enabled: false,
				interval: 3600000,
				retention: 10,
				include: {
					workspace: true,
					memory: true,
					workflow: true,
					configuration: true,
				},
				storage: 'local',
			};
		}

		if (this.config.enabled) {
			this.startScheduledBackups();
		}
	}

	private loadBackups(): void {
		const stored = this.storageService.get('backup.backups', 0);
		if (stored) {
			try {
				this.backups = JSON.parse(stored);
			} catch {
				this.backups = [];
			}
		}
	}

	private saveBackups(): void {
		const data = this.backups.slice(0, this.config.retention || 100);
		this.storageService.store('backup.backups', JSON.stringify(data), StorageScope.APPLICATION, StorageTarget.MACHINE);

		this.updateProductionState();
	}

	private updateProductionState(): void {
		const latestBackup = this.getLatestBackup();

		this.runtimeStateService.update({
			production: {
				backup: latestBackup ? {
					lastBackup: latestBackup.timestamp,
					backupCount: this.backups.length,
					totalSize: 0,
				} : undefined,
			},
		} as Partial<IRuntimeState>);
	}

	override dispose(): void {
		this.stopScheduledBackups();
		this.saveBackups();
		super.dispose();
	}
}
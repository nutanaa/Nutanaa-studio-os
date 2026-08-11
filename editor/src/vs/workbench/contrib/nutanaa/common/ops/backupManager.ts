/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../../base/common/event.js';
import { IBackupConfig, IBackup, IRestorePoint } from '../../models/productionModel.js';

/**
 * Service for backup management in Nutanaa Studio OS Production.
 *
 * Responsibilities:
 * - Workspace backup
 * - Memory backup
 * - Workflow backup
 * - Configuration backup
 * - Restore operations
 * - Snapshots
 * - Versioning
 */
export const IBackupManager = createDecorator<IBackupManager>('nutanaaBackupManager');

export interface IBackupManager {

	// ── Configuration ────────────────────────────────────────────────────────

	/**
	 * Get current backup configuration.
	 * @returns Config
	 */
	getConfig(): IBackupConfig;

	/**
	 * Update backup configuration.
	 * @param config New configuration
	 */
	updateConfig(config: Partial<IBackupConfig>): void;

	/**
	 * Enable or disable backup.
	 * @param enabled Whether enabled
	 */
	setEnabled(enabled: boolean): void;

	// ── Backup Operations ─────────────────────────────────────────────────────

	/**
	 * Create a backup.
	 * @param type Backup type (full or incremental)
	 * @returns Backup info
	 */
	createBackup(type: 'full' | 'incremental'): Promise<IBackup>;

	/**
	 * Get all backups.
	 * @returns All backups
	 */
	getBackups(): IBackup[];

	/**
	 * Get backup by ID.
	 * @param backupId Backup ID
	 * @returns Backup or undefined
	 */
	getBackup(backupId: string): IBackup | undefined;

	/**
	 * Get latest backup.
	 * @returns Latest backup or undefined
	 */
	getLatestBackup(): IBackup | undefined;

	/**
	 * Delete a backup.
	 * @param backupId Backup ID
	 * @returns True if deleted
	 */
	deleteBackup(backupId: string): Promise<boolean>;

	/**
	 * Delete old backups.
	 * @param keep Number of backups to keep
	 * @returns Number deleted
	 */
	deleteOldBackups(keep: number): Promise<number>;

	// ── Restore Operations ───────────────────────────────────────────────────

	/**
	 * Get restore points.
	 * @param since Get points since this time
	 * @returns Restore points
	 */
	getRestorePoints(since?: number): IRestorePoint[];

	/**
	 * Restore from backup.
	 * @param backupId Backup ID
	 * @returns Restore result
	 */
	restore(backupId: string): Promise<{
		success: boolean;
		restoredItems: string[];
		errors: string[];
	}>;

	/**
	 * Restore to a specific point in time.
	 * @param restorePoint Restore point
	 * @returns Restore result
	 */
	restoreToPoint(restorePoint: IRestorePoint): Promise<{
		success: boolean;
		restoredItems: string[];
		errors: string[];
	}>;

	// ── Scheduled Backups ────────────────────────────────────────────────────

	/**
	 * Start scheduled backups.
	 */
	startScheduledBackups(): void;

	/**
	 * Stop scheduled backups.
	 */
	stopScheduledBackups(): void;

	/**
	 * Get next scheduled backup time.
	 * @returns Timestamp or undefined
	 */
	getNextScheduledBackup(): number | undefined;

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when backup completes.
	 */
	onDidCompleteBackup: Event<IBackup>;

	/**
	 * Event fired when restore completes.
	 */
	onDidCompleteRestore: Event<{ backupId: string; success: boolean }>;

	/**
	 * Event fired when backup fails.
	 */
	onDidFailBackup: Event<string>;
}
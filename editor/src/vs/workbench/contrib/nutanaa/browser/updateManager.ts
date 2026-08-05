/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { UpdateChannel, IUpdateConfig, IUpdateInfo, IUpdateProgress } from '../models/productionModel.js';
import { IUpdateManager } from '../common/updateManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../common/runtimeEventBus.js';
import { IRuntimeStateService } from '../common/runtimeState.js';

/**
 * UpdateManager implementation for Nutanaa Studio OS Production.
 *
 * Manages update checking, download, installation, and rollback.
 */
export class UpdateManager extends Disposable implements IUpdateManager {

	declare readonly _serviceBrand: undefined;

	private config: IUpdateConfig;
	private availableUpdate: IUpdateInfo | undefined;
	private downloadProgress: IUpdateProgress | undefined;
	private installProgress: IUpdateProgress | undefined;
	private rollbackVersions: string[] = [];

	private readonly _onDidUpdateAvailable = this._register(new Emitter<IUpdateInfo>());
	private readonly _onDidUpdateDownloaded = this._register(new Emitter<IUpdateInfo>());
	private readonly _onDidUpdateInstalled = this._register(new Emitter<IUpdateInfo>());
	private readonly _onDidDownloadProgress = this._register(new Emitter<IUpdateProgress>());

	public readonly onDidUpdateAvailable = Event.fromEmitter(this._onDidUpdateAvailable);
	public readonly onDidUpdateDownloaded = Event.fromEmitter(this._onDidUpdateDownloaded);
	public readonly onDidUpdateInstalled = Event.fromEmitter(this._onDidUpdateInstalled);
	public readonly onDidDownloadProgress = Event.fromEmitter(this._onDidDownloadProgress);

	private checkInterval: ReturnType<typeof setInterval> | undefined;
	private downloadCancelled = false;

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.loadConfig();
		this.loadRollbackVersions();

		if (this.config.autoCheck) {
			this.startAutoCheck();
		}
	}

	// ── Configuration ────────────────────────────────────────────────────────

	getConfig(): IUpdateConfig {
		return { ...this.config };
	}

	setChannel(channel: UpdateChannel): void {
		this.config.channel = channel;
		this.saveConfig();
		this.logService.info(`Update channel set to ${channel}`);
	}

	setAutoCheck(autoCheck: boolean): void {
		this.config.autoCheck = autoCheck;
		this.saveConfig();

		if (autoCheck) {
			this.startAutoCheck();
		} else {
			this.stopAutoCheck();
		}
	}

	setAutoDownload(autoDownload: boolean): void {
		this.config.autoDownload = autoDownload;
		this.saveConfig();
	}

	setAutoInstall(autoInstall: boolean): void {
		this.config.autoInstall = autoInstall;
		this.saveConfig();
	}

	// ── Update Checks ────────────────────────────────────────────────────────

	async checkForUpdates(): Promise<IUpdateInfo | undefined> {
		this.config.lastCheck = Date.now();
		this.saveConfig();

		// Mock implementation - in production would check actual update server
		const currentVersion = '1.0.0';
		const updateInfo = this.getMockUpdate(currentVersion);

		if (updateInfo) {
			this.availableUpdate = updateInfo;
			this.config.lastCheckVersion = updateInfo.version;

			this._onDidUpdateAvailable.fire(updateInfo);

			this.runtimeEventBus.fire({
				type: RuntimeEventType.UpdateAvailable,
				timestamp: Date.now(),
				payload: {
					version: updateInfo.version,
					channel: updateInfo.channel,
					mandatory: updateInfo.mandatory,
				},
			});

			this.logService.info(`Update available: ${updateInfo.version}`);
		} else {
			this.availableUpdate = undefined;
			this.logService.info('No updates available');
		}

		return this.availableUpdate;
	}

	getAvailableUpdate(): IUpdateInfo | undefined {
		return this.availableUpdate;
	}

	getLastCheckTime(): number | undefined {
		return this.config.lastCheck;
	}

	private getMockUpdate(currentVersion: string): IUpdateInfo | undefined {
		// Mock - pretend there's a newer version
		const channelVersions: Record<UpdateChannel, string> = {
			stable: '1.1.0',
			preview: '1.2.0-beta',
			nightly: '1.3.0-alpha',
		};

		const newVersion = channelVersions[this.config.channel];

		// Only return update if there's a newer version
		if (this.compareVersions(newVersion, currentVersion) > 0) {
			return {
				version: newVersion,
				channel: this.config.channel,
				releaseDate: Date.now(),
				size: 50 * 1024 * 1024, // 50MB
				checksum: 'sha256-mock',
				notes: 'Performance improvements and bug fixes',
				breaking: false,
				mandatory: false,
				downloadUrl: `https://updates.example.com/${newVersion}`,
			};
		}

		return undefined;
	}

	private compareVersions(a: string, b: string): number {
		const parse = (v: string) => v.split(/[.-]/).map((s, i) => {
			const num = parseInt(s, 10);
			return isNaN(num) ? s.charCodeAt(0) : num;
		});

		const aParts = parse(a);
		const bParts = parse(b);

		for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
			const aPart = aParts[i] || 0;
			const bPart = bParts[i] || 0;

			if (typeof aPart === 'number' && typeof bPart === 'number') {
				if (aPart !== bPart) return aPart - bPart;
			} else if (aPart !== bPart) {
				return String(aPart).localeCompare(String(bPart));
			}
		}

		return 0;
	}

	// ── Download & Install ───────────────────────────────────────────────────

	async downloadUpdate(info: IUpdateInfo): Promise<IUpdateProgress> {
		this.downloadCancelled = false;

		const progress: IUpdateProgress = {
			state: 'downloading',
			version: info.version,
			progress: 0,
			speed: 0,
			ETA: 0,
		};

		this.downloadProgress = progress;

		// Simulate download
		const totalSize = info.size;
		let downloaded = 0;

		while (downloaded < totalSize && !this.downloadCancelled) {
			await new Promise(resolve => setTimeout(resolve, 100));
			downloaded += Math.random() * 1024 * 1024; // ~1MB per 100ms

			progress.progress = Math.min(100, (downloaded / totalSize) * 100);
			progress.speed = Math.random() * 10 * 1024 * 1024; // ~10MB/s
			progress.ETA = (totalSize - downloaded) / progress.speed;

			this._onDidDownloadProgress.fire(progress);
		}

		if (this.downloadCancelled) {
			progress.state = 'idle';
			this.downloadProgress = undefined;
			return progress;
		}

		progress.progress = 100;
		progress.state = 'idle';
		this.downloadProgress = undefined;

		this._onDidUpdateDownloaded.fire(info);

		this.logService.info(`Update downloaded: ${info.version}`);

		return progress;
	}

	getDownloadProgress(): IUpdateProgress | undefined {
		return this.downloadProgress;
	}

	cancelDownload(): void {
		this.downloadCancelled = true;
	}

	async installUpdate(info: IUpdateInfo): Promise<IUpdateProgress> {
		const progress: IUpdateProgress = {
			state: 'installing',
			version: info.version,
			progress: 0,
			speed: 0,
			ETA: 0,
		};

		this.installProgress = progress;

		// Simulate installation
		for (let i = 0; i <= 100; i += 10) {
			await new Promise(resolve => setTimeout(resolve, 100));
			progress.progress = i;
		}

		progress.state = 'restarting';

		this._onDidUpdateInstalled.fire(info);

		this.runtimeEventBus.fire({
			type: RuntimeEventType.UpdateInstalled,
			timestamp: Date.now(),
			payload: {
				version: info.version,
				requiresRestart: true,
			},
		});

		// Add current version to rollback versions
		this.addRollbackVersion('1.0.0');

		this.logService.info(`Update installed: ${info.version}`);

		return progress;
	}

	getInstallProgress(): IUpdateProgress | undefined {
		return this.installProgress;
	}

	// ── Rollback ──────────────────────────────────────────────────────────────

	async rollback(version: string): Promise<boolean> {
		if (!this.rollbackVersions.includes(version)) {
			this.logService.error(`Rollback version not found: ${version}`);
			return false;
		}

		// Simulate rollback
		await new Promise(resolve => setTimeout(resolve, 500));

		this.logService.info(`Rolled back to version: ${version}`);

		return true;
	}

	getRollbackVersions(): string[] {
		return [...this.rollbackVersions];
	}

	private addRollbackVersion(version: string): void {
		if (!this.rollbackVersions.includes(version)) {
			this.rollbackVersions.push(version);
			// Keep last 5 versions
			if (this.rollbackVersions.length > 5) {
				this.rollbackVersions.shift();
			}
			this.saveRollbackVersions();
		}
	}

	// ── Auto-Check ───────────────────────────────────────────────────────────

	private startAutoCheck(): void {
		if (this.checkInterval) {
			return;
		}

		// Check every 6 hours
		this.checkInterval = setInterval(() => {
			this.checkForUpdates();
		}, 6 * 60 * 60 * 1000);

		// Also check immediately
		this.checkForUpdates();

		this.logService.info('Auto-update checking started');
	}

	private stopAutoCheck(): void {
		if (this.checkInterval) {
			clearInterval(this.checkInterval);
			this.checkInterval = undefined;
		}
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private loadConfig(): void {
		const stored = this.storageService.get('update.config', 0);
		if (stored) {
			try {
				this.config = JSON.parse(stored);
			} catch {
				this.config = {
					channel: 'stable',
					autoCheck: true,
					autoDownload: false,
					autoInstall: false,
					lastCheck: 0,
					lastCheckVersion: '',
				};
			}
		} else {
			this.config = {
				channel: 'stable',
				autoCheck: true,
				autoDownload: false,
				autoInstall: false,
				lastCheck: 0,
				lastCheckVersion: '',
			};
		}
	}

	private saveConfig(): void {
		this.storageService.store('update.config', JSON.stringify(this.config), 0);
		this.updateProductionState();
	}

	private loadRollbackVersions(): void {
		const stored = this.storageService.get('update.rollbackVersions', 0);
		if (stored) {
			try {
				this.rollbackVersions = JSON.parse(stored);
			} catch {
				this.rollbackVersions = [];
			}
		}
	}

	private saveRollbackVersions(): void {
		this.storageService.store('update.rollbackVersions', JSON.stringify(this.rollbackVersions), 0);
	}

	private updateProductionState(): void {
		this.runtimeStateService.update({
			production: {
				telemetry: undefined,
				metricsHistory: undefined,
				cacheState: undefined,
				offlineStatus: undefined,
				backupStatus: undefined,
				healthSummary: undefined,
				updateInfo: this.availableUpdate,
				updateProgress: this.downloadProgress || this.installProgress,
			},
		});
	}

	override dispose(): void {
		this.stopAutoCheck();
		this.cancelDownload();
		super.dispose();
	}
}
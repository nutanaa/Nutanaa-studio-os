/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { UpdateChannel, IUpdateConfig, IUpdateInfo, IUpdateProgress } from '../models/productionModel.js';

/**
 * Service for update management in Nutanaa Studio OS Production.
 *
 * Responsibilities:
 * - Version checks
 * - Update downloads
 * - Rollback
 * - Update channels (stable, preview, nightly)
 */
export const IUpdateManager = createDecorator<IUpdateManager>('nutanaaUpdateManager');

export interface IUpdateManager {

	// ── Configuration ────────────────────────────────────────────────────────

	/**
	 * Get update configuration.
	 * @returns Config
	 */
	getConfig(): IUpdateConfig;

	/**
	 * Set update channel.
	 * @param channel Channel to set
	 */
	setChannel(channel: UpdateChannel): void;

	/**
	 * Set auto-check setting.
	 * @param autoCheck Whether to auto-check
	 */
	setAutoCheck(autoCheck: boolean): void;

	/**
	 * Set auto-download setting.
	 * @param autoDownload Whether to auto-download
	 */
	setAutoDownload(autoDownload: boolean): void;

	/**
	 * Set auto-install setting.
	 * @param autoInstall Whether to auto-install
	 */
	setAutoInstall(autoInstall: boolean): void;

	// ── Update Checks ────────────────────────────────────────────────────────

	/**
	 * Check for updates.
	 * @returns Update info or undefined if none available
	 */
	checkForUpdates(): Promise<IUpdateInfo | undefined>;

	/**
	 * Get available update.
	 * @returns Update info or undefined
	 */
	getAvailableUpdate(): IUpdateInfo | undefined;

	/**
	 * Get last check time.
	 * @returns Timestamp or undefined
	 */
	getLastCheckTime(): number | undefined;

	// ── Download & Install ───────────────────────────────────────────────────

	/**
	 * Download update.
	 * @param info Update info
	 * @returns Download progress
	 */
	downloadUpdate(info: IUpdateInfo): Promise<IUpdateProgress>;

	/**
	 * Get download progress.
	 * @returns Progress or undefined
	 */
	getDownloadProgress(): IUpdateProgress | undefined;

	/**
	 * Cancel download.
	 */
	cancelDownload(): void;

	/**
	 * Install update.
	 * @param info Update info
	 * @returns Install progress
	 */
	installUpdate(info: IUpdateInfo): Promise<IUpdateProgress>;

	/**
	 * Get install progress.
	 * @returns Progress or undefined
	 */
	getInstallProgress(): IUpdateProgress | undefined;

	// ── Rollback ──────────────────────────────────────────────────────────────

	/**
	 * Rollback to previous version.
	 * @param version Version to rollback to
	 * @returns Success status
	 */
	rollback(version: string): Promise<boolean>;

	/**
	 * Get available versions for rollback.
	 * @returns Array of versions
	 */
	getRollbackVersions(): string[];

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when update is available.
	 */
	onDidUpdateAvailable: (listener: (info: IUpdateInfo) => void) => { dispose(): void };

	/**
	 * Event fired when update is downloaded.
	 */
	onDidUpdateDownloaded: (listener: (info: IUpdateInfo) => void) => { dispose(): void };

	/**
	 * Event fired when update is installed.
	 */
	onDidUpdateInstalled: (listener: (info: IUpdateInfo) => void) => { dispose(): void };

	/**
	 * Event fired when download progress changes.
	 */
	onDidDownloadProgress: (listener: (progress: IUpdateProgress) => void) => { dispose(): void };
}
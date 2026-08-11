/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../base/common/event.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IPackagingManager, IArtifactInfo } from '../../common/ops/packagingManager.js';
import { IRuntimeEventBus } from '../../common/runtime/runtimeEventBus.js';
import { IRuntimeStateService, IRuntimeState } from '../../common/runtime/runtimeState.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';

interface BuildProgress {
	isBuilding: boolean;
	platform?: string;
	progress: number;
	message?: string;
	cancelled?: boolean;
}

interface InstallerProgress {
	type: string;
	platform: string;
	progress: number;
	status: 'pending' | 'building' | 'complete' | 'failed';
	error?: string;
}

interface PackagingConfig {
	outputDir: string;
	signIdentities: Record<string, string>;
	version: string;
	channel: 'stable' | 'preview' | 'nightly';
}

interface ArtifactRecord {
	id: string;
	platform: string;
	type: string;
	path: string;
	size: number;
	checksum: string;
	createdAt: number;
}

class PackagingManager extends Disposable implements IPackagingManager {
	declare readonly _serviceBrand: undefined;

	private readonly _onBuildProgress = this._register(new Emitter<BuildProgress>());
	readonly onBuildProgress = this._onBuildProgress.event;

	private readonly _onInstallerProgress = this._register(new Emitter<InstallerProgress>());
	readonly onInstallerProgress = this._onInstallerProgress.event;

	private readonly _onArtifactCreated = this._register(new Emitter<IArtifactInfo>());
	readonly onArtifactCreated = this._onArtifactCreated.event;

	private readonly _onArtifactDeleted = this._register(new Emitter<{ artifactId: string }>());
	readonly onArtifactDeleted = this._onArtifactDeleted.event;

	private buildProgress: BuildProgress = {
		isBuilding: false,
		platform: undefined,
		progress: 0,
		message: undefined
	};

	private installerProgress: Map<string, InstallerProgress> = new Map();
	private artifacts: Map<string, ArtifactRecord> = new Map();
	private config: PackagingConfig;
	private currentBuildCancellation: (() => void) | undefined;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@ILogService logService: ILogService,
		@IStorageService storageService: IStorageService,
		@IRuntimeEventBus runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService runtimeStateService: IRuntimeStateService
	) {
		super();

		this.config = this.loadConfig();
		this.loadArtifacts();
		this.updateProductionState(runtimeStateService, runtimeEventBus);
	}

	async buildPackage(platform: 'windows' | 'linux' | 'darwin' | 'portable'): Promise<{
		success: boolean;
		artifactPath?: string;
		error?: string;
	}> {
		if (this.buildProgress.isBuilding) {
			return { success: false, error: 'Build already in progress' };
		}

		let resolveCancellation: (() => void) | undefined;
		const cancellationPromise = new Promise<never>((_, reject) => {
			resolveCancellation = () => reject(new Error('Build cancelled'));
		});

		let resolvePromise: (value: { success: boolean; artifactPath?: string; error?: string }) => void;

		this.currentBuildCancellation = resolveCancellation!;

		this.buildProgress = {
			isBuilding: true,
			platform,
			progress: 0,
			message: `Building ${platform} package...`
		};
		this._onBuildProgress.fire(this.buildProgress);

		try {
			const artifactId = `${platform}-${Date.now()}`;
			const artifactPath = this.generateArtifactPath(platform);

			for (let progress = 0; progress <= 100; progress += 10) {
				await Promise.race([
					this.simulateBuildStep(progress, platform),
					cancellationPromise
				]);

				if (this.buildProgress.cancelled) {
					return { success: false, error: 'Build was cancelled' };
				}

				this.buildProgress = {
					isBuilding: true,
					platform,
					progress,
					message: progress < 100 ? `Building ${platform} package... ${progress}%` : 'Finalizing...'
				};
				this._onBuildProgress.fire(this.buildProgress);
			}

			const checksum = this.generateMockChecksum();
			const artifact: ArtifactRecord = {
				id: artifactId,
				platform,
				type: 'package',
				path: artifactPath,
				size: Math.floor(Math.random() * 500000000) + 100000000,
				checksum,
				createdAt: Date.now()
			};

			this.artifacts.set(artifactId, artifact);
			this.saveArtifacts();

			const artifactInfo: IArtifactInfo = {
				id: artifact.id,
				platform: artifact.platform,
				type: artifact.type,
				path: artifact.path,
				size: artifact.size,
				checksum: artifact.checksum,
				createdAt: artifact.createdAt
			};
			this._onArtifactCreated.fire(artifactInfo);

			this.buildProgress = {
				isBuilding: false,
				platform,
				progress: 100,
				message: 'Build complete'
			};
			this._onBuildProgress.fire(this.buildProgress);

			resolvePromise!({ success: true, artifactPath });
			return { success: true, artifactPath };
		} catch (error) {
			this.buildProgress = {
				isBuilding: false,
				platform,
				progress: 0,
				message: `Build failed: ${error instanceof Error ? error.message : String(error)}`
			};
			this._onBuildProgress.fire(this.buildProgress);

			resolvePromise!({ success: false, error: error instanceof Error ? error.message : String(error) });
			return { success: false, error: error instanceof Error ? error.message : String(error) };
		} finally {
			this.currentBuildCancellation = undefined;
		}
	}

	getAvailablePlatforms(): Array<{ id: string; name: string; arch: string[] }> {
		return [
			{ id: 'windows', name: 'Windows', arch: ['x64', 'arm64'] },
			{ id: 'linux', name: 'Linux', arch: ['x64', 'arm64'] },
			{ id: 'darwin', name: 'macOS', arch: ['x64', 'arm64'] },
			{ id: 'portable', name: 'Portable', arch: ['x64'] }
		];
	}

	getBuildStatus(): {
		isBuilding: boolean;
		platform?: string;
		progress: number;
		message?: string;
	} {
		return { ...this.buildProgress };
	}

	cancelBuild(): void {
		if (this.buildProgress.isBuilding && this.currentBuildCancellation) {
			this.buildProgress.cancelled = true;
			this.currentBuildCancellation();
		}
	}

	async generateInstaller(type: 'msi' | 'deb' | 'rpm' | 'dmg' | 'pkg' | 'exe', platform: string): Promise<string> {
		const progressKey = `${type}-${platform}`;

		const progress: InstallerProgress = {
			type,
			platform,
			progress: 0,
			status: 'building'
		};
		this.installerProgress.set(progressKey, progress);
		this._onInstallerProgress.fire(progress);

		await this.simulateInstallerStep(type, platform);

		const installerPath = this.generateInstallerPath(type, platform);

		const updatedProgress: InstallerProgress = {
			type,
			platform,
			progress: 100,
			status: 'complete'
		};
		this.installerProgress.set(progressKey, updatedProgress);
		this._onInstallerProgress.fire(updatedProgress);

		return installerPath;
	}

	getAvailableInstallerTypes(): Array<{ id: string; name: string; platforms: string[] }> {
		return [
			{ id: 'msi', name: 'Windows Installer (MSI)', platforms: ['windows'] },
			{ id: 'exe', name: 'Windows Installer (EXE)', platforms: ['windows'] },
			{ id: 'deb', name: 'Debian Package (DEB)', platforms: ['linux'] },
			{ id: 'rpm', name: 'RPM Package (RPM)', platforms: ['linux'] },
			{ id: 'dmg', name: 'macOS Disk Image (DMG)', platforms: ['darwin'] },
			{ id: 'pkg', name: 'macOS Package (PKG)', platforms: ['darwin'] }
		];
	}

	getArtifacts(): Array<{
		id: string;
		platform: string;
		type: string;
		path: string;
		size: number;
		checksum: string;
		createdAt: number;
	}> {
		return Array.from(this.artifacts.values()).sort((a, b) => b.createdAt - a.createdAt);
	}

	async verifyArtifact(artifactId: string): Promise<{
		valid: boolean;
		expectedChecksum: string;
		actualChecksum: string;
	}> {
		const artifact = this.artifacts.get(artifactId);
		if (!artifact) {
			return { valid: false, expectedChecksum: '', actualChecksum: '' };
		}

		await this.simulateVerification();

		const actualChecksum = this.generateMockChecksum();
		const valid = artifact.checksum === actualChecksum;

		return {
			valid,
			expectedChecksum: artifact.checksum,
			actualChecksum
		};
	}

	async deleteArtifact(artifactId: string): Promise<boolean> {
		const deleted = this.artifacts.delete(artifactId);
		if (deleted) {
			this.saveArtifacts();
			this._onArtifactDeleted.fire({ artifactId });
		}
		return deleted;
	}

	getConfig(): {
		outputDir: string;
		signIdentities: Record<string, string>;
		version: string;
	} {
		return {
			outputDir: this.config.outputDir,
			signIdentities: { ...this.config.signIdentities },
			version: this.config.version
		};
	}

	setOutputDir(dir: string): void {
		this.config.outputDir = dir;
		this.saveConfig();
	}

	setSigningIdentity(platform: string, identity: string): void {
		this.config.signIdentities[platform] = identity;
		this.saveConfig();
	}

	private async simulateBuildStep(currentProgress: number, platform: string): Promise<void> {
		const baseDelay = 50;
		const delay = baseDelay + Math.random() * 100;
		await new Promise(resolve => setTimeout(resolve, delay));
	}

	private async simulateInstallerStep(type: string, platform: string): Promise<void> {
		const baseDelay = 100;
		for (let i = 0; i <= 100; i += 10) {
			await new Promise(resolve => setTimeout(resolve, baseDelay));
		}
	}

	private async simulateVerification(): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, 500));
	}

	private generateArtifactPath(platform: string): string {
		const timestamp = Date.now();
		return `${this.config.outputDir}/nutanaa-studio-${platform}-${timestamp}.zip`;
	}

	private generateInstallerPath(type: string, platform: string): string {
		const timestamp = Date.now();
		return `${this.config.outputDir}/nutanaa-studio-${platform}-${type}-${timestamp}.${this.getExtension(type)}`;
	}

	private getExtension(type: string): string {
		const extensions: Record<string, string> = {
			msi: 'msi',
			exe: 'exe',
			deb: 'deb',
			rpm: 'rpm',
			dmg: 'dmg',
			pkg: 'pkg'
		};
		return extensions[type] || 'bin';
	}

	private generateMockChecksum(): string {
		const chars = '0123456789abcdef';
		let checksum = '';
		for (let i = 0; i < 64; i++) {
			checksum += chars[Math.floor(Math.random() * chars.length)];
		}
		return checksum;
	}

	private loadConfig(): PackagingConfig {
		try {
			const stored = localStorage.getItem('nutanaa-packaging-config');
			if (stored) {
				const parsed = JSON.parse(stored);
				return {
					outputDir: parsed.outputDir || 'artifacts',
					signIdentities: parsed.signIdentities || {},
					version: parsed.version || '1.0.0',
					channel: parsed.channel || 'stable'
				};
			}
		} catch {
		}

		return {
			outputDir: 'artifacts',
			signIdentities: {},
			version: '1.0.0',
			channel: 'stable'
		};
	}

	private saveConfig(): void {
		try {
			localStorage.setItem('nutanaa-packaging-config', JSON.stringify(this.config));
		} catch {
		}
	}

	private loadArtifacts(): void {
		try {
			const stored = localStorage.getItem('nutanaa-packaging-artifacts');
			if (stored) {
				const parsed = JSON.parse(stored);
				this.artifacts = new Map(parsed.map((a: ArtifactRecord) => [a.id, a]));
			}
		} catch {
		}
	}

	private saveArtifacts(): void {
		try {
			localStorage.setItem('nutanaa-packaging-artifacts', JSON.stringify(Array.from(this.artifacts.values())));
		} catch {
		}
	}

	private updateProductionState(runtimeStateService: IRuntimeStateService, runtimeEventBus: IRuntimeEventBus): void {
		runtimeStateService.update({
			production: {
				packaging: {
					isBuilding: this.buildProgress.isBuilding,
					buildProgress: this.buildProgress.progress,
					artifactCount: this.artifacts.size,
					buildChannel: this.config.channel
				}
			},
		} as unknown as Partial<IRuntimeState>);
	}

	override dispose(): void {
		super.dispose();
	}
}

registerSingleton(IPackagingManager, PackagingManager, InstantiationType.Delayed);
export { PackagingManager };
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

/**
 * Artifact information.
 */
export interface IArtifactInfo {
	id: string;
	platform: string;
	type: string;
	path: string;
	size: number;
	checksum: string;
	createdAt: number;
}

/**
 * Service for packaging in Nutanaa Studio OS Production.
 *
 * Responsibilities:
 * - Build packages for Windows, Linux, macOS
 * - Portable package generation
 * - Installer generation
 * - Artifact verification
 */
export const IPackagingManager = createDecorator<IPackagingManager>('nutanaaPackagingManager');

export interface IPackagingManager {

	// ── Package Build ────────────────────────────────────────────────────────

	/**
	 * Build package for a platform.
	 * @param platform Target platform
	 * @returns Build result
	 */
	buildPackage(platform: 'windows' | 'linux' | 'darwin' | 'portable'): Promise<{
		success: boolean;
		artifactPath?: string;
		error?: string;
	}>;

	/**
	 * Get available platforms.
	 * @returns Array of platform names
	 */
	getAvailablePlatforms(): Array<{ id: string; name: string; arch: string[] }>;

	/**
	 * Get build status.
	 * @returns Current build status
	 */
	getBuildStatus(): {
		isBuilding: boolean;
		platform?: string;
		progress: number;
		message?: string;
	};

	/**
	 * Cancel current build.
	 */
	cancelBuild(): void;

	// ── Installer Generation ─────────────────────────────────────────────────

	/**
	 * Generate installer.
	 * @param type Installer type
	 * @param platform Target platform
	 * @returns Installer path
	 */
	generateInstaller(type: 'msi' | 'deb' | 'rpm' | 'dmg' | 'pkg' | 'exe', platform: string): Promise<string>;

	/**
	 * Get available installer types.
	 * @returns Array of installer types
	 */
	getAvailableInstallerTypes(): Array<{ id: string; name: string; platforms: string[] }>;

	// ── Artifact Management ───────────────────────────────────────────────────

	/**
	 * Get built artifacts.
	 * @returns Array of artifacts
	 */
	getArtifacts(): Array<{
		id: string;
		platform: string;
		type: string;
		path: string;
		size: number;
		checksum: string;
		createdAt: number;
	}>;

	/**
	 * Verify artifact integrity.
	 * @param artifactId Artifact ID
	 * @returns Verification result
	 */
	verifyArtifact(artifactId: string): Promise<{
		valid: boolean;
		expectedChecksum: string;
		actualChecksum: string;
	}>;

	/**
	 * Delete artifact.
	 * @param artifactId Artifact ID
	 * @returns True if deleted
	 */
	deleteArtifact(artifactId: string): Promise<boolean>;

	// ── Configuration ────────────────────────────────────────────────────────

	/**
	 * Get packaging configuration.
	 * @returns Config
	 */
	getConfig(): {
		outputDir: string;
		signIdentities: Record<string, string>;
		version: string;
	};

	/**
	 * Set output directory.
	 * @param dir Output directory
	 */
	setOutputDir(dir: string): void;

	/**
	 * Set signing identity.
	 * @param platform Platform
	 * @param identity Signing identity
	 */
	setSigningIdentity(platform: string, identity: string): void;
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../../base/common/event.js';

/**
 * Service for managing configuration in Nutanaa Studio OS Production.
 *
 * Responsibilities:
 * - Settings management
 * - Configuration profiles
 * - Import/export configuration
 * - Schema validation
 * - Configuration migration
 */
export const IConfigurationManager = createDecorator<IConfigurationManager>('nutanaaConfigurationManager');

export interface IConfigurationManager {

	// ── Settings Access ───────────────────────────────────────────────────────

	/**
	 * Get a configuration value.
	 * @param key Configuration key (dot-notation)
	 * @param profile Profile name or undefined for default
	 * @returns Configuration value
	 */
	get<T = unknown>(key: string, profile?: string): T | undefined;

	/**
	 * Set a configuration value.
	 * @param key Configuration key (dot-notation)
	 * @param value Value to set
	 * @param profile Profile name or undefined for default
	 */
	set<T>(key: string, value: T, profile?: string): void;

	/**
	 * Remove a configuration value.
	 * @param key Configuration key
	 * @param profile Profile name or undefined for default
	 */
	remove(key: string, profile?: string): void;

	/**
	 * Check if a configuration key exists.
	 * @param key Configuration key
	 * @param profile Profile name or undefined for default
	 */
	has(key: string, profile?: string): boolean;

	/**
	 * Get all configuration keys.
	 * @param profile Profile name or undefined for default
	 * @returns Array of configuration keys
	 */
	keys(profile?: string): string[];

	// ── Profiles ─────────────────────────────────────────────────────────────

	/**
	 * List all configuration profiles.
	 * @returns Array of profile info
	 */
	listProfiles(): Array<{
		id: string;
		name: string;
		isDefault: boolean;
		isActive: boolean;
		createdAt: number;
		modifiedAt: number;
	}>;

	/**
	 * Create a new configuration profile.
	 * @param name Profile name
	 * @param sourceProfile Source profile to copy from
	 * @returns Created profile ID
	 */
	createProfile(name: string, sourceProfile?: string): string;

	/**
	 * Delete a configuration profile.
	 * @param profileId Profile ID
	 * @returns True if deleted
	 */
	deleteProfile(profileId: string): boolean;

	/**
	 * Rename a configuration profile.
	 * @param profileId Profile ID
	 * @param newName New name
	 * @returns True if renamed
	 */
	renameProfile(profileId: string, newName: string): boolean;

	/**
	 * Set a profile as default.
	 * @param profileId Profile ID
	 */
	setDefaultProfile(profileId: string): void;

	/**
	 * Get the active profile.
	 * @returns Active profile ID
	 */
	getActiveProfile(): string;

	/**
	 * Switch to a different profile.
	 * @param profileId Profile ID
	 */
	switchProfile(profileId: string): void;

	/**
	 * Export a profile configuration.
	 * @param profileId Profile ID
	 * @returns Export data
	 */
	exportProfile(profileId: string): string;

	/**
	 * Import a profile configuration.
	 * @param data Export data
	 * @param name Name for new profile
	 * @returns Import result
	 */
	importProfile(data: string, name?: string): {
		success: boolean;
		profileId?: string;
		error?: string;
	};

	// ── Import/Export ────────────────────────────────────────────────────────

	/**
	 * Export all configuration.
	 * @returns Export data
	 */
	exportAll(): string;

	/**
	 * Import configuration.
	 * @param data Import data
	 * @param options Import options
	 * @returns Import result
	 */
	import(data: string, options?: {
		merge?: boolean;
		profile?: string;
	}): {
		success: boolean;
		warnings?: string[];
		error?: string;
	};

	// ── Validation ───────────────────────────────────────────────────────────

	/**
	 * Validate a configuration value against schema.
	 * @param key Configuration key
	 * @param value Value to validate
	 * @returns Validation result
	 */
	validate(key: string, value: unknown): {
		valid: boolean;
		errors?: string[];
	};

	/**
	 * Validate entire configuration.
	 * @param profile Profile name or undefined for default
	 * @returns Validation result
	 */
	validateAll(profile?: string): {
		valid: boolean;
		errors: Array<{ key: string; error: string }>;
	};

	// ── Migration ───────────────────────────────────────────────────────────

	/**
	 * Get configuration version.
	 * @returns Version string
	 */
	getVersion(): string;

	/**
	 * Set configuration version.
	 * @param version Version string
	 */
	setVersion(version: string): void;

	/**
	 * Migrate configuration to new version.
	 * @param targetVersion Target version
	 * @returns Migration result
	 */
	migrate(targetVersion: string): {
		success: boolean;
		migrated: number;
		errors: string[];
	};

	// ── Reset ───────────────────────────────────────────────────────────────

	/**
	 * Reset configuration to defaults.
	 * @param profile Profile name or undefined for default
	 */
	reset(profile?: string): void;

	/**
	 * Reset a specific key to default.
	 * @param key Configuration key
	 * @param profile Profile name or undefined for default
	 */
	resetKey(key: string, profile?: string): void;

	// ── Watchers ───────────────────────────────────────────────────────────

	/**
	 * Watch for configuration changes.
	 * @returns Event of changed keys
	 */
	onDidChange: Event<{ readonly keys: Array<{ readonly key: string; readonly profile: string }> }>;

	// ── Inspection ───────────────────────────────────────────────────────────

	/**
	 * Inspect configuration value.
	 * @param key Configuration key
	 * @param profile Profile name or undefined for default
	 * @returns Inspection result with default and user values
	 */
	inspect<T = unknown>(key: string, profile?: string): {
		defaultValue?: T;
		userValue?: T;
		profileValue?: T;
		workspaceValue?: T;
		machineValue?: T;
	};
}

/**
 * Configuration profile data.
 */
export interface IConfigurationProfile {
	id: string;
	name: string;
	isDefault: boolean;
	data: Record<string, unknown>;
	createdAt: number;
	modifiedAt: number;
}

/**
 * Configuration export format.
 */
export interface IConfigurationExport {
	version: string;
	exportedAt: number;
	profiles: Array<{
		id: string;
		name: string;
		isDefault: boolean;
		data: Record<string, unknown>;
	}>;
}

/**
 * Configuration schema entry.
 */
export interface IConfigurationSchema {
	type: 'boolean' | 'string' | 'number' | 'array' | 'object';
	description?: string;
	default?: unknown;
	enum?: unknown[];
	minimum?: number;
	maximum?: number;
	minLength?: number;
	maxLength?: number;
	pattern?: string;
}
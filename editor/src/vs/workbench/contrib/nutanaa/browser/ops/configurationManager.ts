/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../base/common/event.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IConfigurationManager, IConfigurationExport, IConfigurationSchema } from '../../common/ops/configurationManager.js';
import { IRuntimeEventBus } from '../../common/runtime/runtimeEventBus.js';
import { IRuntimeStateService, IRuntimeState } from '../../common/runtime/runtimeState.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';

interface ProfileData {
	id: string;
	name: string;
	isDefault: boolean;
	data: Record<string, unknown>;
	createdAt: number;
	modifiedAt: number;
}

interface ChangeEvent {
	keys: Array<{ key: string; profile: string }>;
}

class ConfigurationManager extends Disposable implements IConfigurationManager {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChange = this._register(new Emitter<ChangeEvent>());
	readonly onDidChange = this._onDidChange.event;

	private profiles: Map<string, ProfileData> = new Map();
	private activeProfileId: string = 'default';
	private configVersion: string = '1.0.0';

	private readonly schema: Map<string, IConfigurationSchema> = new Map([
		['ai.enabled', { type: 'boolean', description: 'Enable AI features', default: true }],
		['ai.provider', { type: 'string', description: 'Default AI provider', default: 'openai', enum: ['openai', 'anthropic', 'google'] }],
		['ai.model', { type: 'string', description: 'Default AI model', default: 'gpt-4' }],
		['telemetry.enabled', { type: 'boolean', description: 'Enable telemetry', default: true }],
		['telemetry.anonymous', { type: 'boolean', description: 'Send anonymous telemetry', default: true }],
		['runtime.autoUpdate', { type: 'boolean', description: 'Enable automatic updates', default: true }],
		['runtime.updateChannel', { type: 'string', description: 'Update channel', default: 'stable', enum: ['stable', 'preview', 'nightly'] }],
		['cache.enabled', { type: 'boolean', description: 'Enable caching', default: true }],
		['cache.maxSize', { type: 'number', description: 'Maximum cache size in MB', default: 1024, minimum: 0, maximum: 10240 }],
		['backup.enabled', { type: 'boolean', description: 'Enable automatic backups', default: true }],
		['backup.interval', { type: 'number', description: 'Backup interval in hours', default: 24, minimum: 1, maximum: 168 }],
		['offline.enabled', { type: 'boolean', description: 'Enable offline mode', default: true }],
		['logging.level', { type: 'string', description: 'Log level', default: 'info', enum: ['debug', 'info', 'warning', 'error'] }],
		['logging.maxSize', { type: 'number', description: 'Maximum log file size in MB', default: 10, minimum: 1, maximum: 100 }],
		['performance.profiling', { type: 'boolean', description: 'Enable performance profiling', default: false }],
		['security.encryption', { type: 'boolean', description: 'Enable encryption', default: true }],
		['theme.name', { type: 'string', description: 'Theme name', default: 'vs-dark' }],
		['editor.fontSize', { type: 'number', description: 'Editor font size', default: 14, minimum: 8, maximum: 32 }],
		['editor.fontFamily', { type: 'string', description: 'Editor font family', default: 'Menlo, Monaco, "Courier New", monospace' }],
		['terminal.integrated.shell', { type: 'string', description: 'Terminal shell path', default: '' }],
		['workspace.location', { type: 'string', description: 'Default workspace location', default: '~/nutanaa-workspace' }],
		['extensions.autoUpdate', { type: 'boolean', description: 'Auto update extensions', default: true }],
		['metrics.collect', { type: 'boolean', description: 'Collect metrics', default: true }],
		['metrics.interval', { type: 'number', description: 'Metrics collection interval in seconds', default: 60, minimum: 10, maximum: 3600 }]
	]);

	private readonly defaultValues: Map<string, unknown> = new Map();

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@ILogService logService: ILogService,
		@IStorageService storageService: IStorageService,
		@IRuntimeEventBus runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService runtimeStateService: IRuntimeStateService
	) {
		super();

		this.initializeDefaultValues();
		this.loadProfiles();
		this.updateProductionState(runtimeStateService);
	}

	private initializeDefaultValues(): void {
		for (const [key, schema] of this.schema) {
			if (schema.default !== undefined) {
				this.defaultValues.set(key, schema.default);
			}
		}
	}

	get<T = unknown>(key: string, profile?: string): T | undefined {
		const profileId = profile || this.activeProfileId;
		const profileData = this.profiles.get(profileId);

		if (!profileData) {
			return this.defaultValues.get(key) as T | undefined;
		}

		if (profileData.data.hasOwnProperty(key)) {
			return profileData.data[key] as T;
		}

		return this.defaultValues.get(key) as T | undefined;
	}

	set<T>(key: string, value: T, profile?: string): void {
		const profileId = profile || this.activeProfileId;
		let profileData = this.profiles.get(profileId);

		if (!profileData) {
			profileData = {
				id: profileId,
				name: profileId,
				isDefault: profileId === 'default',
				data: {},
				createdAt: Date.now(),
				modifiedAt: Date.now()
			};
			this.profiles.set(profileId, profileData);
		}

		const oldValue = profileData.data[key];
		profileData.data[key] = value;
		profileData.modifiedAt = Date.now();

		if (oldValue !== value) {
			this._onDidChange.fire({
				keys: [{ key, profile: profileId }]
			});
		}

		this.saveProfiles();
	}

	remove(key: string, profile?: string): void {
		const profileId = profile || this.activeProfileId;
		const profileData = this.profiles.get(profileId);

		if (profileData) {
			delete profileData.data[key];
			profileData.modifiedAt = Date.now();
			this._onDidChange.fire({
				keys: [{ key, profile: profileId }]
			});
			this.saveProfiles();
		}
	}

	has(key: string, profile?: string): boolean {
		const profileId = profile || this.activeProfileId;
		const profileData = this.profiles.get(profileId);

		if (!profileData) {
			return this.defaultValues.has(key);
		}

		return profileData.data.hasOwnProperty(key);
	}

	keys(profile?: string): string[] {
		const profileId = profile || this.activeProfileId;
		const profileData = this.profiles.get(profileId);

		if (!profileData) {
			return Array.from(this.defaultValues.keys());
		}

		const userKeys = Object.keys(profileData.data);
		const defaultKeys = Array.from(this.defaultValues.keys());
		const allKeys = new Set([...userKeys, ...defaultKeys]);

		return Array.from(allKeys);
	}

	listProfiles(): Array<{
		id: string;
		name: string;
		isDefault: boolean;
		isActive: boolean;
		createdAt: number;
		modifiedAt: number;
	}> {
		return Array.from(this.profiles.values()).map(profile => ({
			id: profile.id,
			name: profile.name,
			isDefault: profile.isDefault,
			isActive: profile.id === this.activeProfileId,
			createdAt: profile.createdAt,
			modifiedAt: profile.modifiedAt
		}));
	}

	createProfile(name: string, sourceProfile?: string): string {
		const profileId = `profile-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
		const source = sourceProfile ? this.profiles.get(sourceProfile) : undefined;

		const newProfile: ProfileData = {
			id: profileId,
			name,
			isDefault: false,
			data: source ? { ...source.data } : {},
			createdAt: Date.now(),
			modifiedAt: Date.now()
		};

		this.profiles.set(profileId, newProfile);
		this.saveProfiles();

		return profileId;
	}

	deleteProfile(profileId: string): boolean {
		const profile = this.profiles.get(profileId);
		if (!profile || profile.isDefault) {
			return false;
		}

		this.profiles.delete(profileId);

		if (this.activeProfileId === profileId) {
			this.activeProfileId = 'default';
		}

		this.saveProfiles();
		return true;
	}

	renameProfile(profileId: string, newName: string): boolean {
		const profile = this.profiles.get(profileId);
		if (!profile) {
			return false;
		}

		profile.name = newName;
		profile.modifiedAt = Date.now();
		this.saveProfiles();

		return true;
	}

	setDefaultProfile(profileId: string): void {
		const profile = this.profiles.get(profileId);
		if (!profile) {
			return;
		}

		this.profiles.forEach(p => {
			p.isDefault = p.id === profileId;
		});

		this.saveProfiles();
	}

	getActiveProfile(): string {
		return this.activeProfileId;
	}

	switchProfile(profileId: string): void {
		if (this.profiles.has(profileId)) {
			this.activeProfileId = profileId;
			this.saveProfiles();
		}
	}

	exportProfile(profileId: string): string {
		const profile = this.profiles.get(profileId);
		if (!profile) {
			return '';
		}

		const exportData: IConfigurationExport = {
			version: this.configVersion,
			exportedAt: Date.now(),
			profiles: [{
				id: profile.id,
				name: profile.name,
				isDefault: profile.isDefault,
				data: { ...profile.data }
			}]
		};

		return JSON.stringify(exportData, null, 2);
	}

	importProfile(data: string, name?: string): {
		success: boolean;
		profileId?: string;
		error?: string;
	} {
		try {
			const importData: IConfigurationExport = JSON.parse(data);

			if (!importData.profiles || importData.profiles.length === 0) {
				return { success: false, error: 'No profiles found in import data' };
			}

			const sourceProfile = importData.profiles[0];
			const profileId = `profile-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

			const newProfile: ProfileData = {
				id: profileId,
				name: name || sourceProfile.name,
				isDefault: false,
				data: { ...sourceProfile.data },
				createdAt: Date.now(),
				modifiedAt: Date.now()
			};

			this.profiles.set(profileId, newProfile);
			this.saveProfiles();

			return { success: true, profileId };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : String(error) };
		}
	}

	exportAll(): string {
		const exportData: IConfigurationExport = {
			version: this.configVersion,
			exportedAt: Date.now(),
			profiles: Array.from(this.profiles.values()).map(profile => ({
				id: profile.id,
				name: profile.name,
				isDefault: profile.isDefault,
				data: { ...profile.data }
			}))
		};

		return JSON.stringify(exportData, null, 2);
	}

	import(data: string, options?: {
		merge?: boolean;
		profile?: string;
	}): {
		success: boolean;
		warnings?: string[];
		error?: string;
	} {
		try {
			const importData: IConfigurationExport = JSON.parse(data);
			const warnings: string[] = [];

			if (options?.merge && options.profile) {
				const profile = this.profiles.get(options.profile);
				if (profile) {
					for (const importedProfile of importData.profiles) {
						for (const [key, value] of Object.entries(importedProfile.data)) {
							profile.data[key] = value;
						}
					}
					profile.modifiedAt = Date.now();
					this.saveProfiles();
				} else {
					warnings.push(`Profile '${options.profile}' not found, creating new profile`);
					this.importProfile(data);
				}
			} else {
				const targetProfile = this.activeProfileId;

				if (importData.profiles.length > 0) {
					const sourceProfile = importData.profiles[0];
					const target = this.profiles.get(targetProfile);

					if (target) {
						for (const [key, value] of Object.entries(sourceProfile.data)) {
							const validation = this.validate(key, value);
							if (!validation.valid && validation.errors) {
								warnings.push(`Key '${key}': ${validation.errors.join(', ')}`);
							}
							target.data[key] = value;
						}
						target.modifiedAt = Date.now();
					}
				}

				this.saveProfiles();
			}

			return { success: true, warnings: warnings.length > 0 ? warnings : undefined };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : String(error) };
		}
	}

	validate(key: string, value: unknown): {
		valid: boolean;
		errors?: string[];
	} {
		const schema = this.schema.get(key);

		if (!schema) {
			return { valid: true };
		}

		const errors: string[] = [];

		switch (schema.type) {
			case 'boolean':
				if (typeof value !== 'boolean') {
					errors.push(`Expected boolean, got ${typeof value}`);
				}
				break;

			case 'string':
				if (typeof value !== 'string') {
					errors.push(`Expected string, got ${typeof value}`);
				} else {
					if (schema.minLength !== undefined && value.length < schema.minLength) {
						errors.push(`String must be at least ${schema.minLength} characters`);
					}
					if (schema.maxLength !== undefined && value.length > schema.maxLength) {
						errors.push(`String must be at most ${schema.maxLength} characters`);
					}
					if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
						errors.push(`String does not match required pattern`);
					}
				}
				break;

			case 'number':
				if (typeof value !== 'number' || isNaN(value)) {
					errors.push(`Expected number, got ${typeof value}`);
				} else {
					if (schema.minimum !== undefined && value < schema.minimum) {
						errors.push(`Value must be at least ${schema.minimum}`);
					}
					if (schema.maximum !== undefined && value > schema.maximum) {
						errors.push(`Value must be at most ${schema.maximum}`);
					}
				}
				break;

			case 'array':
				if (!Array.isArray(value)) {
					errors.push(`Expected array, got ${typeof value}`);
				}
				break;

			case 'object':
				if (typeof value !== 'object' || value === null || Array.isArray(value)) {
					errors.push(`Expected object, got ${typeof value}`);
				}
				break;
		}

		if (schema.enum !== undefined && !schema.enum.includes(value)) {
			errors.push(`Value must be one of: ${schema.enum.join(', ')}`);
		}

		return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
	}

	validateAll(profile?: string): {
		valid: boolean;
		errors: Array<{ key: string; error: string }>;
	} {
		const profileId = profile || this.activeProfileId;
		const profileData = this.profiles.get(profileId);
		const errors: Array<{ key: string; error: string }> = [];

		const keysToCheck = profileData
			? [...Object.keys(profileData.data), ...Array.from(this.defaultValues.keys())]
			: Array.from(this.defaultValues.keys());

		const checkedKeys = new Set<string>();

		for (const key of keysToCheck) {
			if (checkedKeys.has(key)) continue;
			checkedKeys.add(key);

			const value = profileData?.data[key] ?? this.defaultValues.get(key);
			const validation = this.validate(key, value);

			if (!validation.valid && validation.errors) {
				for (const error of validation.errors) {
					errors.push({ key, error });
				}
			}
		}

		return { valid: errors.length === 0, errors };
	}

	getVersion(): string {
		return this.configVersion;
	}

	setVersion(version: string): void {
		this.configVersion = version;
		this.saveProfiles();
	}

	migrate(targetVersion: string): {
		success: boolean;
		migrated: number;
		errors: string[];
	} {
		let migrated = 0;
		const errors: string[] = [];

		for (const [key] of this.schema) {
			const currentValue = this.get(key);

			if (currentValue !== undefined) {
				const validation = this.validate(key, currentValue);
				if (!validation.valid && validation.errors) {
					this.remove(key);
					migrated++;
				}
			}
		}

		this.configVersion = targetVersion;
		this.saveProfiles();

		return { success: true, migrated, errors };
	}

	reset(profile?: string): void {
		const profileId = profile || this.activeProfileId;
		const profileData = this.profiles.get(profileId);

		if (profileData) {
			profileData.data = {};
			profileData.modifiedAt = Date.now();
			this.saveProfiles();
		}
	}

	resetKey(key: string, profile?: string): void {
		this.remove(key, profile);
	}

	inspect<T = unknown>(key: string, profile?: string): {
		defaultValue?: T;
		userValue?: T;
		profileValue?: T;
		workspaceValue?: T;
		machineValue?: T;
	} {
		const profileId = profile || this.activeProfileId;
		const profileData = this.profiles.get(profileId);
		const defaultValue = this.defaultValues.get(key) as T | undefined;

		return {
			defaultValue,
			userValue: profileData?.data[key] as T | undefined,
			profileValue: profileData?.data[key] as T | undefined
		};
	}

	private loadProfiles(): void {
		try {
			const stored = localStorage.getItem('nutanaa-config-profiles');
			if (stored) {
				const parsed = JSON.parse(stored);
				this.profiles = new Map(parsed.map((p: ProfileData) => [p.id, p]));
			}

			const storedVersion = localStorage.getItem('nutanaa-config-version');
			if (storedVersion) {
				this.configVersion = storedVersion;
			}

			const activeProfile = localStorage.getItem('nutanaa-config-active-profile');
			if (activeProfile && this.profiles.has(activeProfile)) {
				this.activeProfileId = activeProfile;
			}
		} catch {
			this.initializeDefaultProfiles();
		}
	}

	private initializeDefaultProfiles(): void {
		const defaultProfile: ProfileData = {
			id: 'default',
			name: 'Default',
			isDefault: true,
			data: {},
			createdAt: Date.now(),
			modifiedAt: Date.now()
		};

		this.profiles.set('default', defaultProfile);
		this.saveProfiles();
	}

	private saveProfiles(): void {
		try {
			localStorage.setItem('nutanaa-config-profiles', JSON.stringify(Array.from(this.profiles.values())));
			localStorage.setItem('nutanaa-config-version', this.configVersion);
			localStorage.setItem('nutanaa-config-active-profile', this.activeProfileId);
		} catch {
		}
	}

	private updateProductionState(runtimeStateService: IRuntimeStateService): void {
		runtimeStateService.update({
			production: {
				configuration: {
					profileCount: this.profiles.size,
					activeProfile: this.activeProfileId,
					configVersion: this.configVersion,
				},
			},
		} as Partial<IRuntimeState>);
	}

	override dispose(): void {
		super.dispose();
	}
}

registerSingleton(IConfigurationManager, ConfigurationManager, InstantiationType.Delayed);
export { ConfigurationManager };
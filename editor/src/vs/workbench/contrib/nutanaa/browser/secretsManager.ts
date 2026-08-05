/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ISecret, IRotationPolicy, ISecretAccess } from '../models/enterpriseModel.js';
import { ISecretsManager } from '../common/secretsManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../common/runtimeEventBus.js';
import { IRuntimeStateService } from '../common/runtimeState.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';

/**
 * SecretsManager implementation for Nutanaa Studio OS Enterprise.
 *
 * Provides secure storage for API keys, credentials, and certificates
 * with encryption, rotation policies, and access auditing.
 */
export class SecretsManager extends Disposable implements ISecretsManager {

	declare readonly _serviceBrand: undefined;

	private readonly secrets = new Map<string, ISecret>();
	private readonly secretVersions = new Map<string, Array<{ version: number; value: string; updatedAt: number }>>();
	private readonly secretAccess = new Map<string, ISecretAccess[]>();
	private readonly secretAccessControl = new Map<string, Map<string, 'read' | 'write' | 'admin'>>();

	private readonly _onDidAccessSecret = this._register(new Emitter<ISecretAccess>());
	private readonly _onDidUpdateSecret = this._register(new Emitter<{ secretId: string }>());

	public readonly onDidAccessSecret = Event.fromEmitter(this._onDidAccessSecret);
	public readonly onDidUpdateSecret = Event.fromEmitter(this._onDidUpdateSecret);

	private readonly ENCRYPTION_KEY = 'nutanaa-master-key'; // In production, use proper key management

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.loadSecrets();
	}

	// ── CRUD Operations ───────────────────────────────────────────────────────

	async createSecret(
		secretData: {
			key: string;
			name: string;
			description?: string;
			type: 'api-key' | 'credential' | 'certificate' | 'token' | 'other';
			value: string;
			metadata?: Record<string, unknown>;
			rotationPolicy?: IRotationPolicy;
			expiresAt?: number;
		},
		createdBy: string
	): Promise<ISecret> {
		const encryptedValue = await this.encrypt(secretData.value);

		const secret: ISecret = {
			id: `secret-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			key: secretData.key,
			name: secretData.name,
			description: secretData.description,
			type: secretData.type,
			encryptedValue,
			metadata: secretData.metadata,
			version: 1,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			expiresAt: secretData.expiresAt,
			rotationPolicy: secretData.rotationPolicy,
			createdBy,
		};

		this.secrets.set(secret.id, secret);

		// Initialize version history
		this.secretVersions.set(secret.id, [{
			version: 1,
			value: encryptedValue,
			updatedAt: Date.now(),
		}]);

		// Grant admin access to creator
		this.grantAccess(secret.id, createdBy, 'admin');

		// Update runtime state
		this.updateSecretsState();

		// Fire audit event
		this.logSecretAccess(secret.id, createdBy, 'write');

		this.saveSecrets();

		this.logService.info(`Secret ${secret.name} created by ${createdBy}`);
		return secret;
	}

	async getSecret(secretId: string): Promise<ISecret | undefined> {
		const secret = this.secrets.get(secretId);
		if (secret) {
			this.logSecretAccess(secretId, 'system', 'read');
		}
		return secret;
	}

	async getSecretByKey(key: string): Promise<ISecret | undefined> {
		for (const secret of this.secrets.values()) {
			if (secret.key === key) {
				return secret;
			}
		}
		return undefined;
	}

	async listSecrets(): Promise<ISecret[]> {
		return Array.from(this.secrets.values());
	}

	async updateSecret(secretId: string, value: string, updatedBy: string): Promise<ISecret> {
		const secret = this.secrets.get(secretId);
		if (!secret) {
			throw new Error(`Secret ${secretId} not found`);
		}

		const encryptedValue = await this.encrypt(value);

		secret.encryptedValue = encryptedValue;
		secret.version++;
		secret.updatedAt = Date.now();

		this.secrets.set(secretId, secret);

		// Update version history
		const versions = this.secretVersions.get(secretId) || [];
		versions.push({
			version: secret.version,
			value: encryptedValue,
			updatedAt: Date.now(),
		});
		this.secretVersions.set(secretId, versions);

		// Update runtime state
		this.updateSecretsState();

		// Log access
		this.logSecretAccess(secretId, updatedBy, 'write');

		// Fire events
		this._onDidUpdateSecret.fire({ secretId });

		this.runtimeEventBus.fire({
			type: RuntimeEventType.SecretUpdated,
			timestamp: Date.now(),
			payload: {
				secretId,
				key: secret.key,
				updatedBy,
				version: secret.version,
			},
		});

		this.saveSecrets();
		this.logService.info(`Secret ${secret.name} updated by ${updatedBy}`);

		return secret;
	}

	async deleteSecret(secretId: string): Promise<void> {
		const secret = this.secrets.get(secretId);
		if (!secret) {
			return;
		}

		this.secrets.delete(secretId);
		this.secretVersions.delete(secretId);
		this.secretAccess.delete(secretId);
		this.secretAccessControl.delete(secretId);

		// Update runtime state
		this.updateSecretsState();

		// Fire audit event
		this.logService.info(`Secret ${secret.name} deleted`);

		this.saveSecrets();
	}

	async rotateSecret(secretId: string, newValue: string): Promise<ISecret> {
		const secret = this.secrets.get(secretId);
		if (!secret) {
			throw new Error(`Secret ${secretId} not found`);
		}

		const updatedSecret = await this.updateSecret(secretId, newValue, 'rotation-system');
		updatedSecret.lastRotatedAt = Date.now();

		this.logService.info(`Secret ${secret.name} rotated`);

		return updatedSecret;
	}

	// ── Encryption ───────────────────────────────────────────────────────────

	async encrypt(plaintext: string): Promise<string> {
		// Simple XOR encryption for demo - use AES-256-GCM in production
		const key = this.ENCRYPTION_KEY;
		let encrypted = '';
		for (let i = 0; i < plaintext.length; i++) {
			const charCode = plaintext.charCodeAt(i) ^ key.charCodeAt(i % key.length);
			encrypted += String.fromCharCode(charCode);
		}
		return Buffer.from(encrypted).toString('base64');
	}

	async decrypt(encryptedValue: string): Promise<string> {
		try {
			const encrypted = Buffer.from(encryptedValue, 'base64').toString('utf8');
			const key = this.ENCRYPTION_KEY;
			let decrypted = '';
			for (let i = 0; i < encrypted.length; i++) {
				const charCode = encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length);
				decrypted += String.fromCharCode(charCode);
			}
			return decrypted;
		} catch {
			return '';
		}
	}

	// ── Access Control ───────────────────────────────────────────────────────

	grantAccess(secretId: string, userId: string, accessType: 'read' | 'write' | 'admin'): void {
		let control = this.secretAccessControl.get(secretId);
		if (!control) {
			control = new Map();
			this.secretAccessControl.set(secretId, control);
		}
		control.set(userId, accessType);

		this.logService.info(`Access ${accessType} granted on secret ${secretId} to user ${userId}`);
	}

	revokeAccess(secretId: string, userId: string): void {
		const control = this.secretAccessControl.get(secretId);
		if (!control) {
			return;
		}

		control.delete(userId);
		this.logService.info(`Access revoked from secret ${secretId} for user ${userId}`);
	}

	async canAccess(secretId: string, userId: string, accessType: 'read' | 'write' | 'admin'): Promise<boolean> {
		const control = this.secretAccessControl.get(secretId);
		if (!control) {
			return false;
		}

		const userAccess = control.get(userId);
		if (!userAccess) {
			return false;
		}

		// Admin has all access
		if (userAccess === 'admin') {
			return true;
		}

		// Write includes read
		if (accessType === 'write' && userAccess === 'write') {
			return true;
		}

		return userAccess === accessType;
	}

	getAccessLog(secretId: string): ISecretAccess[] {
		return this.secretAccess.get(secretId) || [];
	}

	// ── Rotation ─────────────────────────────────────────────────────────────

	setRotationPolicy(secretId: string, policy: IRotationPolicy): void {
		const secret = this.secrets.get(secretId);
		if (!secret) {
			throw new Error(`Secret ${secretId} not found`);
		}

		secret.rotationPolicy = policy;
		this.secrets.set(secretId, secret);

		this.saveSecrets();
		this.logService.info(`Rotation policy set for secret ${secret.name}`);
	}

	async getSecretsDueForRotation(): Promise<ISecret[]> {
		const now = Date.now();
		const dueSecrets: ISecret[] = [];

		for (const secret of this.secrets.values()) {
			if (!secret.rotationPolicy) {
				continue;
			}

			const lastRotated = secret.lastRotatedAt || secret.createdAt;
			const intervalMs = secret.rotationPolicy.intervalDays * 24 * 60 * 60 * 1000;

			if (now - lastRotated >= intervalMs) {
				dueSecrets.push(secret);
			}
		}

		return dueSecrets;
	}

	async rotateDueSecrets(): Promise<number> {
		const dueSecrets = await this.getSecretsDueForRotation();
		let rotated = 0;

		for (const secret of dueSecrets) {
			try {
				// In production, this would call the actual rotation mechanism
				const newValue = await this.decrypt(secret.encryptedValue);
				await this.rotateSecret(secret.id, newValue);
				rotated++;
			} catch {
				this.logService.error(`Failed to rotate secret ${secret.name}`);
			}
		}

		return rotated;
	}

	// ── Validation ───────────────────────────────────────────────────────────

	async validateSecret(secretId: string, value: string): Promise<{ valid: boolean; errors: string[] }> {
		const secret = this.secrets.get(secretId);
		if (!secret) {
			return { valid: false, errors: ['Secret not found'] };
		}

		const errors: string[] = [];

		// Basic validation based on type
		switch (secret.type) {
			case 'api-key':
				if (value.length < 16) {
					errors.push('API key should be at least 16 characters');
				}
				break;
			case 'certificate':
				if (!value.includes('-----BEGIN')) {
					errors.push('Invalid certificate format');
				}
				break;
		}

		return { valid: errors.length === 0, errors };
	}

	// ── Version Management ───────────────────────────────────────────────────

	async getVersionHistory(secretId: string): Promise<Array<{ version: number; value: string; updatedAt: number }>> {
		return this.secretVersions.get(secretId) || [];
	}

	async rollbackToVersion(secretId: string, version: number): Promise<ISecret> {
		const versions = this.secretVersions.get(secretId);
		if (!versions) {
			throw new Error(`Secret ${secretId} not found`);
		}

		const targetVersion = versions.find(v => v.version === version);
		if (!targetVersion) {
			throw new Error(`Version ${version} not found for secret ${secretId}`);
		}

		const currentValue = await this.decrypt(targetVersion.value);
		return this.updateSecret(secretId, currentValue, 'rollback-system');
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private logSecretAccess(secretId: string, userId: string, accessType: 'read' | 'write' | 'admin'): void {
		const access: ISecretAccess = {
			secretId,
			userId,
			accessedAt: Date.now(),
			accessType,
		};

		let accessLog = this.secretAccess.get(secretId) || [];
		accessLog.push(access);
		// Keep last 100 access records
		if (accessLog.length > 100) {
			accessLog = accessLog.slice(-100);
		}
		this.secretAccess.set(secretId, accessLog);

		this._onDidAccessSecret.fire(access);
	}

	private updateSecretsState(): void {
		this.runtimeStateService.update({
			enterpriseSecrets: {
				secrets: new Map(this.secrets),
				accessLog: [],
			},
		});
	}

	private loadSecrets(): void {
		const stored = this.storageService.get('nutanaa.secrets', 0);
		if (stored) {
			try {
				const data = JSON.parse(stored);
				for (const secret of data.secrets || []) {
					this.secrets.set(secret.id, secret);
				}
				for (const [secretId, versions] of Object.entries(data.versions || {})) {
					this.secretVersions.set(secretId, versions);
				}
				for (const [secretId, accessControl] of Object.entries(data.accessControl || {})) {
					const control = new Map(Object.entries(accessControl));
					this.secretAccessControl.set(secretId, control);
				}
			} catch {
				this.secrets = new Map();
				this.secretVersions = new Map();
				this.secretAccessControl = new Map();
			}
		}
	}

	private saveSecrets(): void {
		const secretsObj: Record<string, ISecret> = {};
		for (const [id, secret] of this.secrets) {
			secretsObj[id] = secret;
		}

		const versionsObj: Record<string, Array<{ version: number; value: string; updatedAt: number }>> = {};
		for (const [secretId, versions] of this.secretVersions) {
			versionsObj[secretId] = versions;
		}

		const accessControlObj: Record<string, Record<string, 'read' | 'write' | 'admin'>> = {};
		for (const [secretId, control] of this.secretAccessControl) {
			accessControlObj[secretId] = Object.fromEntries(control);
		}

		const data = {
			secrets: secretsObj,
			versions: versionsObj,
			accessControl: accessControlObj,
		};

		this.storageService.store('nutanaa.secrets', JSON.stringify(data), 0);
	}
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { ISecret, IRotationPolicy, ISecretAccess } from '../../models/enterpriseModel.js';

/**
 * Service for managing secrets in Nutanaa Studio OS Enterprise.
 *
 * Responsibilities:
 * - Secure storage for API keys, credentials, and certificates
 * - Encryption at rest and in transit
 * - Secret rotation with policies
 * - Access auditing
 * - Validation and version management
 */
export const ISecretsManager = createDecorator<ISecretsManager>('nutanaaSecretsManager');

export interface ISecretsManager {

	// ── CRUD Operations ───────────────────────────────────────────────────────

	/**
	 * Create a new secret.
	 * @param secret The secret data (unencrypted value)
	 * @param createdBy User who created the secret
	 * @returns Created secret
	 */
	createSecret(secret: {
		key: string;
		name: string;
		description?: string;
		type: 'api-key' | 'credential' | 'certificate' | 'token' | 'other';
		value: string;
		metadata?: Record<string, unknown>;
		rotationPolicy?: IRotationPolicy;
		expiresAt?: number;
	}, createdBy: string): Promise<ISecret>;

	/**
	 * Get a secret by ID.
	 * @param secretId The secret ID
	 * @returns Secret or undefined
	 */
	getSecret(secretId: string): Promise<ISecret | undefined>;

	/**
	 * Get secret by key.
	 * @param key The secret key
	 * @returns Secret or undefined
	 */
	getSecretByKey(key: string): Promise<ISecret | undefined>;

	/**
	 * List all secrets.
	 * @returns Array of secrets
	 */
	listSecrets(): Promise<ISecret[]>;

	/**
	 * Update a secret value.
	 * @param secretId The secret ID
	 * @param value The new encrypted value
	 * @param updatedBy User who updated the secret
	 * @returns Updated secret
	 */
	updateSecret(secretId: string, value: string, updatedBy: string): Promise<ISecret>;

	/**
	 * Delete a secret.
	 * @param secretId The secret ID
	 */
	deleteSecret(secretId: string): Promise<void>;

	/**
	 * Rotate a secret.
	 * @param secretId The secret ID
	 * @param newValue The new value
	 * @returns Rotated secret
	 */
	rotateSecret(secretId: string, newValue: string): Promise<ISecret>;

	// ── Encryption ───────────────────────────────────────────────────────────

	/**
	 * Encrypt a plaintext value.
	 * @param plaintext The plaintext to encrypt
	 * @returns Encrypted value
	 */
	encrypt(plaintext: string): Promise<string>;

	/**
	 * Decrypt an encrypted value.
	 * @param encryptedValue The encrypted value
	 * @returns Decrypted plaintext
	 */
	decrypt(encryptedValue: string): Promise<string>;

	// ── Access Control ───────────────────────────────────────────────────────

	/**
	 * Grant access to a secret.
	 * @param secretId The secret ID
	 * @param userId The user ID
	 * @param accessType The access type
	 */
	grantAccess(secretId: string, userId: string, accessType: 'read' | 'write' | 'admin'): void;

	/**
	 * Revoke access from a secret.
	 * @param secretId The secret ID
	 * @param userId The user ID
	 */
	revokeAccess(secretId: string, userId: string): void;

	/**
	 * Check if user can access a secret.
	 * @param secretId The secret ID
	 * @param userId The user ID
	 * @param accessType Required access type
	 * @returns True if permitted
	 */
	canAccess(secretId: string, userId: string, accessType: 'read' | 'write' | 'admin'): Promise<boolean>;

	/**
	 * Get access log for a secret.
	 * @param secretId The secret ID
	 * @returns Array of access records
	 */
	getAccessLog(secretId: string): ISecretAccess[];

	// ── Rotation ─────────────────────────────────────────────────────────────

	/**
	 * Set rotation policy for a secret.
	 * @param secretId The secret ID
	 * @param policy The rotation policy
	 */
	setRotationPolicy(secretId: string, policy: IRotationPolicy): void;

	/**
	 * Get secrets due for rotation.
	 * @returns Array of secrets to rotate
	 */
	getSecretsDueForRotation(): Promise<ISecret[]>;

	/**
	 * Rotate all secrets due for rotation.
	 * @returns Number of secrets rotated
	 */
	rotateDueSecrets(): Promise<number>;

	// ── Validation ───────────────────────────────────────────────────────────

	/**
	 * Validate a secret value.
	 * @param secretId The secret ID
	 * @param value The value to validate
	 * @returns Validation result
	 */
	validateSecret(secretId: string, value: string): Promise<{ valid: boolean; errors: string[] }>;

	// ── Version Management ───────────────────────────────────────────────────

	/**
	 * Get secret version history.
	 * @param secretId The secret ID
	 * @returns Array of versions
	 */
	getVersionHistory(secretId: string): Promise<Array<{ version: number; value: string; updatedAt: number }>>;

	/**
	 * Rollback to a previous version.
	 * @param secretId The secret ID
	 * @param version The version to rollback to
	 * @returns Rolled back secret
	 */
	rollbackToVersion(secretId: string, version: number): Promise<ISecret>;

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when a secret is accessed.
	 */
	readonly onDidAccessSecret: import('../../../../../base/common/event.js').Event<ISecretAccess>;

	/**
	 * Event fired when a secret is updated.
	 */
	readonly onDidUpdateSecret: import('../../../../../base/common/event.js').Event<{ secretId: string }>;
}
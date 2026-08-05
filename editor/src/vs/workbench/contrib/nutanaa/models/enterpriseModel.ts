/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Enterprise Platform Model Types for Nutanaa Studio OS
 *
 * Defines all interfaces for authentication, authorization, secrets,
 * plugins, remote execution, and organization management.
 */

// ── Authentication Types ───────────────────────────────────────────────────────

export type AuthProviderType = 'local' | 'oauth2' | 'oidc' | 'saml' | 'apikey';

export interface IAuthProvider {
	readonly id: string;
	readonly type: AuthProviderType;
	readonly name: string;
	readonly enabled: boolean;
	readonly config: IAuthProviderConfig;
}

export interface IAuthProviderConfig {
	readonly clientId?: string;
	readonly clientSecret?: string;
	readonly issuer?: string;
	readonly redirectUri?: string;
	readonly scopes?: string[];
	readonly apiKeyHeader?: string;
}

export interface IUserCredentials {
	readonly username: string;
	readonly password?: string;
	readonly providerId?: string;
}

export interface IAuthToken {
	readonly accessToken: string;
	readonly refreshToken?: string;
	readonly tokenType: string;
	readonly expiresAt: number;
	readonly scope?: string;
}

export interface IUserSession {
	readonly id: string;
	readonly userId: string;
	readonly providerId: string;
	readonly token: IAuthToken;
	readonly createdAt: number;
	readonly lastActivityAt: number;
	readonly ipAddress?: string;
	readonly userAgent?: string;
}

export interface IUser {
	readonly id: string;
	readonly username: string;
	readonly email: string;
	readonly displayName: string;
	readonly avatarUrl?: string;
	readonly roles: string[];
	readonly groups: string[];
	readonly enabled: boolean;
	readonly createdAt: number;
	readonly lastLoginAt?: number;
	readonly metadata?: Record<string, unknown>;
}

// ── Authorization Types ───────────────────────────────────────────────────────

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'execute' | 'admin';

export type ResourceType = 'workspace' | 'project' | 'agent' | 'workflow' | 'provider' | 'secret' | 'plugin' | 'user' | 'team' | 'organization';

export interface IPermission {
	readonly resourceType: ResourceType;
	readonly resourceId?: string;
	readonly actions: PermissionAction[];
}

export interface IRole {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly permissions: IPermission[];
	readonly isSystem: boolean;
}

export interface IAccessPolicy {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly rules: IPolicyRule[];
	readonly priority: number;
	readonly enabled: boolean;
}

export interface IPolicyRule {
	readonly condition: IPolicyCondition;
	readonly effect: 'allow' | 'deny';
	readonly permissions: IPermission[];
}

export interface IPolicyCondition {
	readonly userRoles?: string[];
	readonly userGroups?: string[];
	readonly resourceOwner?: string;
	readonly timeRange?: { start: number; end: number };
	readonly ipRanges?: string[];
}

// ── Secrets Types ────────────────────────────────────────────────────────────

export interface ISecret {
	readonly id: string;
	readonly key: string;
	readonly name: string;
	readonly description?: string;
	readonly type: 'api-key' | 'credential' | 'certificate' | 'token' | 'other';
	readonly encryptedValue: string;
	readonly metadata?: Record<string, unknown>;
	readonly version: number;
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly expiresAt?: number;
	readonly rotationPolicy?: IRotationPolicy;
	readonly lastRotatedAt?: number;
	readonly createdBy: string;
}

export interface IRotationPolicy {
	readonly intervalDays: number;
	readonly gracePeriodDays: number;
	readonly notifyBeforeDays: number;
}

export interface ISecretAccess {
	readonly secretId: string;
	readonly userId: string;
	readonly accessedAt: number;
	readonly accessType: 'read' | 'write' | 'admin';
}

// ── Organization Types ───────────────────────────────────────────────────────

export interface IOrganization {
	readonly id: string;
	readonly name: string;
	readonly slug: string;
	readonly description?: string;
	readonly avatarUrl?: string;
	readonly settings: IOrganizationSettings;
	readonly createdAt: number;
	readonly createdBy: string;
}

export interface IOrganizationSettings {
	readonly defaultRole: string;
	readonly mfaRequired: boolean;
	readonly ipWhitelist?: string[];
	readonly allowedAuthProviders: string[];
}

export interface ITeam {
	readonly id: string;
	readonly organizationId: string;
	readonly name: string;
	readonly description?: string;
	readonly memberIds: string[];
	readonly roleIds: string[];
	readonly createdAt: number;
}

export interface ITeamMembership {
	readonly teamId: string;
	readonly userId: string;
	readonly role: string;
	readonly joinedAt: number;
}

// ── Plugin Types ──────────────────────────────────────────────────────────────

export interface IPluginManifest {
	readonly id: string;
	readonly name: string;
	readonly version: string;
	readonly displayName: string;
	readonly description: string;
	readonly author: string;
	readonly license?: string;
	readonly repository?: string;
	readonly homepage?: string;
	readonly categories: string[];
	readonly engines?: { vscode: string };
	readonly dependencies?: Record<string, string>;
	readonly main?: string;
	readonly contributes?: IPluginContributions;
	readonly activationEvents?: string[];
}

export interface IPluginContributions {
	readonly commands?: Array<{
		id: string;
		title: string;
		category?: string;
	}>;
	readonly views?: Array<{
		id: string;
		name: string;
		type: string;
	}>;
	readonly panels?: Array<{
		id: string;
		title: string;
	}>;
	readonly configuration?: Record<string, unknown>;
	readonly menus?: Array<{
		id: string;
		items: Array<{ command: string }>;
	}>;
}

export interface IPlugin {
	readonly id: string;
	readonly manifest: IPluginManifest;
	readonly path: string;
	readonly state: 'installed' | 'loading' | 'loaded' | 'unloading' | 'error';
	readonly installedAt: number;
	readonly updatedAt: number;
	readonly enabled: boolean;
	readonly error?: string;
}

export interface IPluginDependency {
	readonly pluginId: string;
	readonly versionRange: string;
	readonly satisfied: boolean;
}

// ── Marketplace Types ─────────────────────────────────────────────────────────

export interface IPluginListing {
	readonly id: string;
	readonly name: string;
	readonly displayName: string;
	readonly description: string;
	readonly author: string;
	readonly version: string;
	readonly downloadCount: number;
	readonly rating: number;
	readonly categories: string[];
	readonly tags: string[];
	readonly iconUrl?: string;
	readonly screenshots?: string[];
	readonly repository?: string;
	readonly homepage?: string;
	readonly license?: string;
	readonly lastUpdated: number;
	readonly publishedAt: number;
}

export interface IMarketplaceSearchResult {
	readonly count: number;
	readonly listings: IPluginListing[];
}

export interface IInstallOptions {
	readonly version?: string;
	readonly force?: boolean;
	readonly skipDependencies?: boolean;
}

// ── Remote Runtime Types ──────────────────────────────────────────────────────

export interface IRemoteAgent {
	readonly id: string;
	readonly name: string;
	readonly endpoint: string;
	readonly status: 'connected' | 'disconnected' | 'connecting' | 'error';
	readonly capabilities: string[];
	readonly lastHeartbeat: number;
	readonly load: number;
	readonly metadata?: Record<string, unknown>;
}

export interface INodeInfo {
	readonly nodeId: string;
	readonly role: 'master' | 'worker' | 'edge';
	readonly address: string;
	readonly status: 'online' | 'offline' | 'degraded';
	readonly capabilities: string[];
	readonly load: number;
	readonly lastSeen: number;
	readonly version: string;
}

export interface IClusterState {
	readonly nodes: Map<string, INodeInfo>;
	readonly masterNode: string | undefined;
	readonly totalLoad: number;
	readonly averageLoad: number;
}

// ── Audit Types ───────────────────────────────────────────────────────────────

export type AuditEventType =
	| 'user.login'
	| 'user.logout'
	| 'user.login_failed'
	| 'user.created'
	| 'user.updated'
	| 'user.deleted'
	| 'permission.granted'
	| 'permission.revoked'
	| 'secret.created'
	| 'secret.updated'
	| 'secret.deleted'
	| 'secret.accessed'
	| 'plugin.installed'
	| 'plugin.uninstalled'
	| 'plugin.updated'
	| 'workflow.executed'
	| 'provider.used'
	| 'api.request'
	| 'security.alerts';

export interface IAuditEvent {
	readonly id: string;
	readonly type: AuditEventType;
	readonly timestamp: number;
	readonly userId?: string;
	readonly organizationId?: string;
	readonly resourceType?: string;
	readonly resourceId?: string;
	readonly action: string;
	readonly result: 'success' | 'failure' | 'partial';
	readonly ipAddress?: string;
	readonly userAgent?: string;
	readonly metadata?: Record<string, unknown>;
	readonly errorMessage?: string;
}

export interface IAuditQuery {
	readonly types?: AuditEventType[];
	readonly userIds?: string[];
	readonly resourceTypes?: string[];
	readonly startTime?: number;
	readonly endTime?: number;
	readonly limit?: number;
}

// ── Enterprise State Types ───────────────────────────────────────────────────

export interface IEnterpriseState {
	readonly currentUser: IUser | undefined;
	readonly currentOrganization: IOrganization | undefined;
	readonly session: IUserSession | undefined;
	readonly isAuthenticated: boolean;
	readonly userPermissions: IPermission[];
	readonly userRoles: string[];
	readonly organizationTeamIds: string[];
}

export interface IClusterStateSlice {
	readonly nodes: ReadonlyMap<string, INodeInfo>;
	readonly masterNode: string | undefined;
	readonly totalLoad: number;
}

export interface IPluginsStateSlice {
	readonly installed: ReadonlyMap<string, IPlugin>;
	readonly marketplace: IPluginListing[];
}

export interface ISecretsStateSlice {
	readonly secrets: ReadonlyMap<string, ISecret>;
	readonly accessLog: ISecretAccess[];
}

// ── Event Payloads for RuntimeEventBus ───────────────────────────────────────

export interface IUserLoggedInPayload {
	readonly user: IUser;
	readonly providerId: string;
	readonly sessionId: string;
}

export interface IUserLoggedOutPayload {
	readonly userId: string;
	readonly sessionId: string;
	readonly reason: string;
}

export interface IPermissionChangedPayload {
	readonly userId: string;
	readonly permissions: IPermission[];
	readonly changeType: 'granted' | 'revoked';
}

export interface IPluginInstalledPayload {
	readonly pluginId: string;
	readonly version: string;
	readonly userId: string;
}

export interface IPluginRemovedPayload {
	readonly pluginId: string;
	readonly userId: string;
}

export interface INodeConnectedPayload {
	readonly nodeId: string;
	readonly endpoint: string;
	readonly capabilities: string[];
}

export interface INodeDisconnectedPayload {
	readonly nodeId: string;
	readonly reason: string;
}

export interface IOrganizationChangedPayload {
	readonly organizationId: string;
	readonly changeType: 'joined' | 'left' | 'updated';
}

export interface ISecretUpdatedPayload {
	readonly secretId: string;
	readonly key: string;
	readonly updatedBy: string;
	readonly version: number;
}
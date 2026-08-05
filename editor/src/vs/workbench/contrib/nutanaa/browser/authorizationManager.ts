/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import {
	PermissionAction,
	ResourceType,
	IPermission,
	IRole,
	IAccessPolicy,
	IPolicyRule,
} from '../models/enterpriseModel.js';
import { IAuthorizationManager } from '../common/authorizationManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../common/runtimeEventBus.js';
import { IRuntimeStateService } from '../common/runtimeState.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';

/**
 * Default system roles for Nutanaa Studio OS Enterprise.
 */
const SYSTEM_ROLES: IRole[] = [
	{
		id: 'role-admin',
		name: 'Administrator',
		description: 'Full access to all resources and settings',
		permissions: [
			{
				resourceType: '*',
				actions: ['create', 'read', 'update', 'delete', 'execute', 'admin'],
			},
		],
		isSystem: true,
	},
	{
		id: 'role-developer',
		name: 'Developer',
		description: 'Can create and manage projects, agents, and workflows',
		permissions: [
			{
				resourceType: 'workspace',
				actions: ['read', 'update'],
			},
			{
				resourceType: 'project',
				actions: ['create', 'read', 'update', 'delete'],
			},
			{
				resourceType: 'agent',
				actions: ['create', 'read', 'update', 'delete', 'execute'],
			},
			{
				resourceType: 'workflow',
				actions: ['create', 'read', 'update', 'delete', 'execute'],
			},
			{
				resourceType: 'provider',
				actions: ['read'],
			},
			{
				resourceType: 'secret',
				actions: ['read'],
			},
		],
		isSystem: true,
	},
	{
		id: 'role-operator',
		name: 'Operator',
		description: 'Can monitor and manage runtime operations',
		permissions: [
			{
				resourceType: 'workspace',
				actions: ['read'],
			},
			{
				resourceType: 'project',
				actions: ['read'],
			},
			{
				resourceType: 'agent',
				actions: ['read', 'execute'],
			},
			{
				resourceType: 'workflow',
				actions: ['read', 'execute'],
			},
			{
				resourceType: 'provider',
				actions: ['read'],
			},
		],
		isSystem: true,
	},
	{
		id: 'role-viewer',
		name: 'Viewer',
		description: 'Read-only access to resources',
		permissions: [
			{
				resourceType: 'workspace',
				actions: ['read'],
			},
			{
				resourceType: 'project',
				actions: ['read'],
			},
			{
				resourceType: 'agent',
				actions: ['read'],
			},
			{
				resourceType: 'workflow',
				actions: ['read'],
			},
			{
				resourceType: 'provider',
				actions: ['read'],
			},
		],
		isSystem: true,
	},
	{
		id: 'role-guest',
		name: 'Guest',
		description: 'Limited access for external collaborators',
		permissions: [
			{
				resourceType: 'workspace',
				actions: ['read'],
			},
		],
		isSystem: true,
	},
];

/**
 * AuthorizationManager implementation for Nutanaa Studio OS Enterprise.
 *
 * Manages RBAC with role hierarchy, permission inheritance,
 * and policy-based access control.
 */
export class AuthorizationManager extends Disposable implements IAuthorizationManager {

	declare readonly _serviceBrand: undefined;

	private readonly roles = new Map<string, IRole>();
	private readonly userRoles = new Map<string, Set<string>>();
	private readonly userPermissions = new Map<string, IPermission[]>();
	private readonly groupPermissions = new Map<string, IPermission[]>();
	private readonly workspacePermissions = new Map<string, Map<string, IPermission[]>>();
	private readonly projectPermissions = new Map<string, Map<string, IPermission[]>>();
	private readonly policies = new Map<string, IAccessPolicy>();

	private readonly _onDidPermissionsChange = this._register(new Emitter<{ userId: string; permissions: IPermission[] }>());

	public readonly onDidPermissionsChange = Event.fromEmitter(this._onDidPermissionsChange);

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.initializeSystemRoles();
		this.loadPersistedData();
	}

	private initializeSystemRoles(): void {
		for (const role of SYSTEM_ROLES) {
			this.roles.set(role.id, role);
		}
	}

	// ── Role Management ───────────────────────────────────────────────────────

	getRoles(): IRole[] {
		return Array.from(this.roles.values());
	}

	getRole(roleId: string): IRole | undefined {
		return this.roles.get(roleId);
	}

	getRoleByName(roleName: string): IRole | undefined {
		for (const role of this.roles.values()) {
			if (role.name === roleName) {
				return role;
			}
		}
		return undefined;
	}

	createRole(roleData: Omit<IRole, 'id' | 'isSystem'>): IRole {
		const role: IRole = {
			...roleData,
			id: `role-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			isSystem: false,
		};

		this.roles.set(role.id, role);
		this.saveRoles();

		this.logService.info(`Role ${role.name} created`);
		return role;
	}

	updateRole(roleId: string, updates: Partial<IRole>): void {
		const role = this.roles.get(roleId);
		if (!role) {
			throw new Error(`Role ${roleId} not found`);
		}

		if (role.isSystem) {
			throw new Error('Cannot modify system roles');
		}

		const updatedRole = { ...role, ...updates };
		this.roles.set(roleId, updatedRole);
		this.saveRoles();

		this.logService.info(`Role ${roleId} updated`);
	}

	deleteRole(roleId: string): void {
		const role = this.roles.get(roleId);
		if (!role) {
			return;
		}

		if (role.isSystem) {
			throw new Error('Cannot delete system roles');
		}

		this.roles.delete(roleId);

		// Remove role from all users
		for (const [userId, roles] of this.userRoles.entries()) {
			roles.delete(roleId);
		}

		this.saveRoles();
		this.logService.info(`Role ${roleId} deleted`);
	}

	// ── Permission Management ─────────────────────────────────────────────────

	async hasPermission(
		userId: string,
		resourceType: ResourceType,
		resourceId: string | undefined,
		action: PermissionAction
	): Promise<boolean> {
		const decision = await this.evaluateAccess(userId, resourceType, resourceId || '', action);
		return decision === 'allow';
	}

	async getUserPermissions(userId: string): Promise<IPermission[]> {
		const permissions: IPermission[] = [];

		// Get role-based permissions
		const roles = this.userRoles.get(userId);
		if (roles) {
			for (const roleId of roles) {
				const role = this.roles.get(roleId);
				if (role) {
					permissions.push(...role.permissions);
				}
			}
		}

		// Add direct permissions
		const directPermissions = this.userPermissions.get(userId);
		if (directPermissions) {
			permissions.push(...directPermissions);
		}

		return permissions;
	}

	grantUserPermission(userId: string, permission: IPermission): void {
		const permissions = this.userPermissions.get(userId) || [];
		permissions.push(permission);
		this.userPermissions.set(userId, permissions);

		this.updateUserPermissionState(userId);
		this.firePermissionChange(userId);

		this.logService.info(`Permission granted to user ${userId}`);
	}

	revokeUserPermission(
		userId: string,
		resourceType: ResourceType,
		resourceId: string | undefined,
		action: PermissionAction
	): void {
		const permissions = this.userPermissions.get(userId);
		if (!permissions) {
			return;
		}

		const index = permissions.findIndex(
			p => p.resourceType === resourceType &&
				p.resourceId === resourceId &&
				p.actions.includes(action)
		);

		if (index !== -1) {
			permissions.splice(index, 1);
			this.userPermissions.set(userId, permissions);

			this.updateUserPermissionState(userId);
			this.firePermissionChange(userId);

			this.logService.info(`Permission revoked from user ${userId}`);
		}
	}

	// ── Group Permissions ─────────────────────────────────────────────────────

	getGroupPermissions(groupId: string): IPermission[] {
		return this.groupPermissions.get(groupId) || [];
	}

	grantGroupPermission(groupId: string, permission: IPermission): void {
		const permissions = this.groupPermissions.get(groupId) || [];
		permissions.push(permission);
		this.groupPermissions.set(groupId, permissions);

		this.logService.info(`Permission granted to group ${groupId}`);
	}

	revokeGroupPermission(
		groupId: string,
		resourceType: ResourceType,
		resourceId: string | undefined,
		action: PermissionAction
	): void {
		const permissions = this.groupPermissions.get(groupId);
		if (!permissions) {
			return;
		}

		const index = permissions.findIndex(
			p => p.resourceType === resourceType &&
				p.resourceId === resourceId &&
				p.actions.includes(action)
		);

		if (index !== -1) {
			permissions.splice(index, 1);
			this.groupPermissions.set(groupId, permissions);

			this.logService.info(`Permission revoked from group ${groupId}`);
		}
	}

	// ── Workspace Permissions ─────────────────────────────────────────────────

	getWorkspacePermissions(workspaceId: string): IPermission[] {
		const workspacePerms = this.workspacePermissions.get(workspaceId);
		if (!workspacePerms) {
			return [];
		}

		const allPermissions: IPermission[] = [];
		for (const permissions of workspacePerms.values()) {
			allPermissions.push(...permissions);
		}
		return allPermissions;
	}

	grantWorkspacePermission(workspaceId: string, principalId: string, permission: IPermission): void {
		let workspacePerms = this.workspacePermissions.get(workspaceId);
		if (!workspacePerms) {
			workspacePerms = new Map();
			this.workspacePermissions.set(workspaceId, workspacePerms);
		}

		const permissions = workspacePerms.get(principalId) || [];
		permissions.push(permission);
		workspacePerms.set(principalId, permissions);

		this.logService.info(`Permission granted on workspace ${workspaceId} to ${principalId}`);
	}

	revokeWorkspacePermission(
		workspaceId: string,
		principalId: string,
		resourceType: ResourceType,
		action: PermissionAction
	): void {
		const workspacePerms = this.workspacePermissions.get(workspaceId);
		if (!workspacePerms) {
			return;
		}

		const permissions = workspacePerms.get(principalId);
		if (!permissions) {
			return;
		}

		const index = permissions.findIndex(
			p => p.resourceType === resourceType &&
				p.actions.includes(action)
		);

		if (index !== -1) {
			permissions.splice(index, 1);
			workspacePerms.set(principalId, permissions);

			this.logService.info(`Permission revoked on workspace ${workspaceId} from ${principalId}`);
		}
	}

	// ── Project Permissions ───────────────────────────────────────────────────

	getProjectPermissions(projectId: string): IPermission[] {
		const projectPerms = this.projectPermissions.get(projectId);
		if (!projectPerms) {
			return [];
		}

		const allPermissions: IPermission[] = [];
		for (const permissions of projectPerms.values()) {
			allPermissions.push(...permissions);
		}
		return allPermissions;
	}

	grantProjectPermission(projectId: string, principalId: string, permission: IPermission): void {
		let projectPerms = this.projectPermissions.get(projectId);
		if (!projectPerms) {
			projectPerms = new Map();
			this.projectPermissions.set(projectId, projectPerms);
		}

		const permissions = projectPerms.get(principalId) || [];
		permissions.push(permission);
		projectPerms.set(principalId, permissions);

		this.logService.info(`Permission granted on project ${projectId} to ${principalId}`);
	}

	revokeProjectPermission(
		projectId: string,
		principalId: string,
		resourceType: ResourceType,
		action: PermissionAction
	): void {
		const projectPerms = this.projectPermissions.get(projectId);
		if (!projectPerms) {
			return;
		}

		const permissions = projectPerms.get(principalId);
		if (!permissions) {
			return;
		}

		const index = permissions.findIndex(
			p => p.resourceType === resourceType &&
				p.actions.includes(action)
		);

		if (index !== -1) {
			permissions.splice(index, 1);
			projectPerms.set(principalId, permissions);

			this.logService.info(`Permission revoked on project ${projectId} from ${principalId}`);
		}
	}

	// ── Policy Management ─────────────────────────────────────────────────────

	getPolicies(): IAccessPolicy[] {
		return Array.from(this.policies.values()).filter(p => p.enabled);
	}

	createPolicy(policyData: Omit<IAccessPolicy, 'id'>): IAccessPolicy {
		const policy: IAccessPolicy = {
			...policyData,
			id: `policy-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		};

		this.policies.set(policy.id, policy);
		this.savePolicies();

		this.logService.info(`Policy ${policy.name} created`);
		return policy;
	}

	updatePolicy(policyId: string, updates: Partial<IAccessPolicy>): void {
		const policy = this.policies.get(policyId);
		if (!policy) {
			throw new Error(`Policy ${policyId} not found`);
		}

		const updatedPolicy = { ...policy, ...updates };
		this.policies.set(policyId, updatedPolicy);
		this.savePolicies();

		this.logService.info(`Policy ${policyId} updated`);
	}

	deletePolicy(policyId: string): void {
		if (!this.policies.has(policyId)) {
			return;
		}

		this.policies.delete(policyId);
		this.savePolicies();

		this.logService.info(`Policy ${policyId} deleted`);
	}

	async evaluateAccess(
		userId: string,
		resourceType: ResourceType,
		resourceId: string,
		action: PermissionAction
	): Promise<'allow' | 'deny'> {
		// Get user's effective permissions
		const effectivePermissions = await this.getEffectivePermissions(userId);

		// Check wildcard permissions first
		const wildcardPermission = effectivePermissions.find(
			p => p.resourceType === '*' && p.actions.includes(action)
		);
		if (wildcardPermission) {
			return 'allow';
		}

		// Check specific resource type permissions
		const matchingPermissions = effectivePermissions.filter(
			p => (p.resourceType === resourceType || p.resourceType === '*') &&
				p.actions.includes(action) &&
				(!p.resourceId || p.resourceId === resourceId || p.resourceId === '*')
		);

		if (matchingPermissions.length > 0) {
			return 'allow';
		}

		// Check policies
		const policies = Array.from(this.policies.values())
			.filter(p => p.enabled)
			.sort((a, b) => a.priority - b.priority);

		for (const policy of policies) {
			const decision = this.evaluatePolicy(policy, userId, resourceType, resourceId, action);
			if (decision !== null) {
				return decision;
			}
		}

		return 'deny';
	}

	private async getEffectivePermissions(userId: string): Promise<IPermission[]> {
		const permissions: IPermission[] = [];

		// Get role-based permissions
		const roles = this.userRoles.get(userId);
		if (roles) {
			for (const roleId of roles) {
				const role = this.roles.get(roleId);
				if (role) {
					permissions.push(...role.permissions);
				}
			}
		}

		// Add direct user permissions
		const directPermissions = this.userPermissions.get(userId);
		if (directPermissions) {
			permissions.push(...directPermissions);
		}

		return permissions;
	}

	private evaluatePolicy(
		policy: IAccessPolicy,
		userId: string,
		resourceType: ResourceType,
		resourceId: string,
		action: PermissionAction
	): 'allow' | 'deny' | null {
		for (const rule of policy.rules) {
			if (this.matchesCondition(rule.condition, userId, resourceType, resourceId)) {
				return rule.effect;
			}
		}
		return null;
	}

	private matchesCondition(
		condition: IPolicyCondition,
		userId: string,
		resourceType: ResourceType,
		resourceId: string
	): boolean {
		// Check user roles condition
		if (condition.userRoles && condition.userRoles.length > 0) {
			const userRoles = this.userRoles.get(userId) || new Set();
			const hasRole = Array.from(userRoles).some(r => condition.userRoles!.includes(r));
			if (!hasRole) {
				return false;
			}
		}

		// Check user groups condition
		if (condition.userGroups && condition.userGroups.length > 0) {
			// Would check group membership here
			return false;
		}

		// Check resource owner condition
		if (condition.resourceOwner) {
			// Would check resource ownership here
			return false;
		}

		// Check time range condition
		if (condition.timeRange) {
			const now = Date.now();
			if (now < condition.timeRange.start || now > condition.timeRange.end) {
				return false;
			}
		}

		// Check IP range condition
		if (condition.ipRanges && condition.ipRanges.length > 0) {
			// Would check client IP here
			return false;
		}

		return true;
	}

	// ── Role Assignment ───────────────────────────────────────────────────────

	assignRoleToUser(userId: string, roleId: string): void {
		if (!this.roles.has(roleId)) {
			throw new Error(`Role ${roleId} not found`);
		}

		let roles = this.userRoles.get(userId);
		if (!roles) {
			roles = new Set();
			this.userRoles.set(userId, roles);
		}

		roles.add(roleId);
		this.updateUserPermissionState(userId);
		this.firePermissionChange(userId);

		this.logService.info(`Role ${roleId} assigned to user ${userId}`);
	}

	removeRoleFromUser(userId: string, roleId: string): void {
		const roles = this.userRoles.get(userId);
		if (!roles) {
			return;
		}

		roles.delete(roleId);
		this.updateUserPermissionState(userId);
		this.firePermissionChange(userId);

		this.logService.info(`Role ${roleId} removed from user ${userId}`);
	}

	getUserRoles(userId: string): string[] {
		const roles = this.userRoles.get(userId);
		return roles ? Array.from(roles) : [];
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private updateUserPermissionState(userId: string): void {
		this.getUserPermissions(userId).then(permissions => {
			this.runtimeStateService.update({
				enterprise: {
					currentUser: undefined,
					currentOrganization: undefined,
					session: undefined,
					isAuthenticated: false,
					userPermissions: permissions,
					userRoles: this.getUserRoles(userId),
					organizationTeamIds: [],
				},
			});
		});
	}

	private firePermissionChange(userId: string): void {
		this.getUserPermissions(userId).then(permissions => {
			this._onDidPermissionsChange.fire({ userId, permissions });

			this.runtimeEventBus.fire({
				type: RuntimeEventType.PermissionChanged,
				timestamp: Date.now(),
				payload: {
					userId,
					permissions,
					changeType: 'granted' as const,
				},
			});
		});
	}

	private loadPersistedData(): void {
		const storedRoles = this.storageService.get('nutanaa.roles', 0);
		if (storedRoles) {
			try {
				const data = JSON.parse(storedRoles);
				for (const role of data.roles || []) {
					this.roles.set(role.id, role);
				}
			} catch {
				this.initializeSystemRoles();
			}
		}

		const storedPermissions = this.storageService.get('nutanaa.permissions', 0);
		if (storedPermissions) {
			try {
				const data = JSON.parse(storedPermissions);
				for (const [userId, permissions] of Object.entries(data.userPermissions || {})) {
					this.userPermissions.set(userId, permissions);
				}
				for (const [groupId, permissions] of Object.entries(data.groupPermissions || {})) {
					this.groupPermissions.set(groupId, permissions);
				}
			} catch {
				// Use defaults
			}
		}

		const storedPolicies = this.storageService.get('nutanaa.policies', 0);
		if (storedPolicies) {
			try {
				const data = JSON.parse(storedPolicies);
				for (const policy of data.policies || []) {
					this.policies.set(policy.id, policy);
				}
			} catch {
				// Use defaults
			}
		}
	}

	private saveRoles(): void {
		const data = {
			roles: Array.from(this.roles.values()),
		};
		this.storageService.store('nutanaa.roles', JSON.stringify(data), 0);
	}

	private savePermissions(): void {
		const data = {
			userPermissions: Object.fromEntries(this.userPermissions),
			groupPermissions: Object.fromEntries(this.groupPermissions),
		};
		this.storageService.store('nutanaa.permissions', JSON.stringify(data), 0);
	}

	private savePolicies(): void {
		const data = {
			policies: Array.from(this.policies.values()),
		};
		this.storageService.store('nutanaa.policies', JSON.stringify(data), 0);
	}
}
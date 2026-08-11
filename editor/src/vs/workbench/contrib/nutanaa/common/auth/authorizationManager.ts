/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import {
	PermissionAction,
	ResourceType,
	IPermission,
	IRole,
	IAccessPolicy,
} from '../../models/enterpriseModel.js';

/**
 * Service for managing Role-Based Access Control (RBAC) in Nutanaa Studio OS Enterprise.
 *
 * Responsibilities:
 * - Role management and permission assignment
 * - Policy evaluation for access decisions
 * - User, group, workspace, and project permissions
 * - Permission inheritance and overrides
 */
export const IAuthorizationManager = createDecorator<IAuthorizationManager>('nutanaaAuthorizationManager');

export interface IAuthorizationManager {

	// ── Role Management ───────────────────────────────────────────────────────

	/**
	 * Get all available roles.
	 * @returns Array of roles
	 */
	getRoles(): IRole[];

	/**
	 * Get role by ID.
	 * @param roleId The role ID
	 * @returns Role or undefined
	 */
	getRole(roleId: string): IRole | undefined;

	/**
	 * Get role by name.
	 * @param roleName The role name
	 * @returns Role or undefined
	 */
	getRoleByName(roleName: string): IRole | undefined;

	/**
	 * Create a new role.
	 * @param role The role to create
	 * @returns Created role
	 */
	createRole(role: Omit<IRole, 'id' | 'isSystem'>): IRole;

	/**
	 * Update a role.
	 * @param roleId The role ID
	 * @param updates The updates
	 */
	updateRole(roleId: string, updates: Partial<IRole>): void;

	/**
	 * Delete a role.
	 * @param roleId The role ID
	 */
	deleteRole(roleId: string): void;

	// ── Permission Management ─────────────────────────────────────────────────

	/**
	 * Check if user has permission for an action on a resource.
	 * @param userId The user ID
	 * @param resourceType The resource type
	 * @param resourceId The resource ID (optional for type-level access)
	 * @param action The action to perform
	 * @returns True if permitted
	 */
	hasPermission(
		userId: string,
		resourceType: ResourceType,
		resourceId: string | undefined,
		action: PermissionAction
	): Promise<boolean>;

	/**
	 * Get all effective permissions for a user.
	 * @param userId The user ID
	 * @returns Array of permissions
	 */
	getUserPermissions(userId: string): Promise<IPermission[]>;

	/**
	 * Grant permission to a user.
	 * @param userId The user ID
	 * @param permission The permission to grant
	 */
	grantUserPermission(userId: string, permission: IPermission): void;

	/**
	 * Revoke permission from a user.
	 * @param userId The user ID
	 * @param resourceType The resource type
	 * @param resourceId The resource ID
	 * @param action The action
	 */
	revokeUserPermission(
		userId: string,
		resourceType: ResourceType,
		resourceId: string | undefined,
		action: PermissionAction
	): void;

	// ── Group Permissions ─────────────────────────────────────────────────────

	/**
	 * Get permissions for a group.
	 * @param groupId The group ID
	 * @returns Array of permissions
	 */
	getGroupPermissions(groupId: string): IPermission[];

	/**
	 * Grant permission to a group.
	 * @param groupId The group ID
	 * @param permission The permission
	 */
	grantGroupPermission(groupId: string, permission: IPermission): void;

	/**
	 * Revoke permission from a group.
	 * @param groupId The group ID
	 * @param resourceType The resource type
	 * @param resourceId The resource ID
	 * @param action The action
	 */
	revokeGroupPermission(
		groupId: string,
		resourceType: ResourceType,
		resourceId: string | undefined,
		action: PermissionAction
	): void;

	// ── Workspace Permissions ─────────────────────────────────────────────────

	/**
	 * Get permissions for a workspace.
	 * @param workspaceId The workspace ID
	 * @returns Array of permissions
	 */
	getWorkspacePermissions(workspaceId: string): IPermission[];

	/**
	 * Grant permission on workspace.
	 * @param workspaceId The workspace ID
	 * @param principalId The user or group ID
	 * @param permission The permission
	 */
	grantWorkspacePermission(workspaceId: string, principalId: string, permission: IPermission): void;

	/**
	 * Revoke permission on workspace.
	 * @param workspaceId The workspace ID
	 * @param principalId The user or group ID
	 * @param resourceType The resource type
	 * @param action The action
	 */
	revokeWorkspacePermission(
		workspaceId: string,
		principalId: string,
		resourceType: ResourceType,
		action: PermissionAction
	): void;

	// ── Project Permissions ───────────────────────────────────────────────────

	/**
	 * Get permissions for a project.
	 * @param projectId The project ID
	 * @returns Array of permissions
	 */
	getProjectPermissions(projectId: string): IPermission[];

	/**
	 * Grant permission on project.
	 * @param projectId The project ID
	 * @param principalId The user or group ID
	 * @param permission The permission
	 */
	grantProjectPermission(projectId: string, principalId: string, permission: IPermission): void;

	/**
	 * Revoke permission on project.
	 * @param projectId The project ID
	 * @param principalId The user or group ID
	 * @param resourceType The resource type
	 * @param action The action
	 */
	revokeProjectPermission(
		projectId: string,
		principalId: string,
		resourceType: ResourceType,
		action: PermissionAction
	): void;

	// ── Policy Management ─────────────────────────────────────────────────────

	/**
	 * Get all policies.
	 * @returns Array of policies
	 */
	getPolicies(): IAccessPolicy[];

	/**
	 * Create a new policy.
	 * @param policy The policy to create
	 * @returns Created policy
	 */
	createPolicy(policy: Omit<IAccessPolicy, 'id'>): IAccessPolicy;

	/**
	 * Update a policy.
	 * @param policyId The policy ID
	 * @param updates The updates
	 */
	updatePolicy(policyId: string, updates: Partial<IAccessPolicy>): void;

	/**
	 * Delete a policy.
	 * @param policyId The policy ID
	 */
	deletePolicy(policyId: string): void;

	/**
	 * Evaluate access based on policies.
	 * @param userId The user ID
	 * @param resourceType The resource type
	 * @param resourceId The resource ID
	 * @param action The action
	 * @returns Access decision
	 */
	evaluateAccess(
		userId: string,
		resourceType: ResourceType,
		resourceId: string,
		action: PermissionAction
	): Promise<'allow' | 'deny'>;

	// ── Role Assignment ───────────────────────────────────────────────────────

	/**
	 * Assign role to user.
	 * @param userId The user ID
	 * @param roleId The role ID
	 */
	assignRoleToUser(userId: string, roleId: string): void;

	/**
	 * Remove role from user.
	 * @param userId The user ID
	 * @param roleId The role ID
	 */
	removeRoleFromUser(userId: string, roleId: string): void;

	/**
	 * Get roles assigned to user.
	 * @param userId The user ID
	 * @returns Array of role IDs
	 */
	getUserRoles(userId: string): string[];

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when permissions change.
	 */
	readonly onDidPermissionsChange: import('../../../../../base/common/event.js').Event<{ userId: string; permissions: IPermission[] }>;
}
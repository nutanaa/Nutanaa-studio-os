/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../../base/common/event.js';
import { IOrganization, ITeam, ITeamMembership } from '../../models/enterpriseModel.js';

/**
 * Service for managing organizations, teams, and users in Nutanaa Studio OS Enterprise.
 *
 * Responsibilities:
 * - Organization management (CRUD)
 * - Team management within organizations
 * - User membership and role assignment
 * - Shared resource management
 * - Organization settings and policies
 */
export const IOrganizationManager = createDecorator<IOrganizationManager>('nutanaaOrganizationManager');

export interface IOrganizationManager {

	// ── Organization Management ───────────────────────────────────────────────

	/**
	 * Get current organization.
	 * @returns Current organization or undefined
	 */
	getCurrentOrganization(): IOrganization | undefined;

	/**
	 * Get organization by ID.
	 * @param organizationId The organization ID
	 * @returns Organization or undefined
	 */
	getOrganization(organizationId: string): IOrganization | undefined;

	/**
	 * Get all organizations the current user has access to.
	 * @returns Array of organizations
	 */
	getMyOrganizations(): IOrganization[];

	/**
	 * Create a new organization.
	 * @param data Organization data
	 * @param createdBy User creating the organization
	 * @returns Created organization
	 */
	createOrganization(data: {
		name: string;
		description?: string;
		settings?: IOrganization['settings'];
	}, createdBy: string): Promise<IOrganization>;

	/**
	 * Update an organization.
	 * @param organizationId The organization ID
	 * @param updates Updates to apply
	 */
	updateOrganization(organizationId: string, updates: Partial<IOrganization>): Promise<void>;

	/**
	 * Delete an organization.
	 * @param organizationId The organization ID
	 */
	deleteOrganization(organizationId: string): Promise<void>;

	/**
	 * Join an organization.
	 * @param organizationId The organization ID
	 * @param userId The user ID
	 */
	joinOrganization(organizationId: string, userId: string): Promise<void>;

	/**
	 * Leave an organization.
	 * @param organizationId The organization ID
	 * @param userId The user ID
	 */
	leaveOrganization(organizationId: string, userId: string): Promise<void>;

	// ── Team Management ───────────────────────────────────────────────────────

	/**
	 * Get teams in an organization.
	 * @param organizationId The organization ID
	 * @returns Array of teams
	 */
	getTeams(organizationId: string): ITeam[];

	/**
	 * Get team by ID.
	 * @param teamId The team ID
	 * @returns Team or undefined
	 */
	getTeam(teamId: string): ITeam | undefined;

	/**
	 * Create a new team.
	 * @param teamData Team data
	 * @returns Created team
	 */
	createTeam(teamData: {
		organizationId: string;
		name: string;
		description?: string;
		memberIds?: string[];
		roleIds?: string[];
	}): Promise<ITeam>;

	/**
	 * Update a team.
	 * @param teamId The team ID
	 * @param updates Updates to apply
	 */
	updateTeam(teamId: string, updates: Partial<ITeam>): Promise<void>;

	/**
	 * Delete a team.
	 * @param teamId The team ID
	 */
	deleteTeam(teamId: string): Promise<void>;

	// ── Team Membership ───────────────────────────────────────────────────────

	/**
	 * Add user to a team.
	 * @param teamId The team ID
	 * @param userId The user ID
	 * @param role The user's role in the team
	 */
	addTeamMember(teamId: string, userId: string, role: string): void;

	/**
	 * Remove user from a team.
	 * @param teamId The team ID
	 * @param userId The user ID
	 */
	removeTeamMember(teamId: string, userId: string): void;

	/**
	 * Update team member role.
	 * @param teamId The team ID
	 * @param userId The user ID
	 * @param role The new role
	 */
	updateTeamMemberRole(teamId: string, userId: string, role: string): void;

	/**
	 * Get user's team memberships.
	 * @param userId The user ID
	 * @returns Array of team memberships
	 */
	getUserTeamMemberships(userId: string): ITeamMembership[];

	// ── Shared Resources ───────────────────────────────────────────────────────

	/**
	 * Get shared resources for an organization.
	 * @param organizationId The organization ID
	 * @returns Map of resource type to resources
	 */
	getSharedResources(organizationId: string): Map<string, Array<{ id: string; name: string; type: string }>>;

	/**
	 * Share a resource with an organization.
	 * @param organizationId The organization ID
	 * @param resourceType Resource type
	 * @param resourceId Resource ID
	 * @param permissions Permissions to grant
	 */
	shareResource(
		organizationId: string,
		resourceType: string,
		resourceId: string,
		permissions: { read: string[]; write: string[] }
	): void;

	/**
	 * Unshare a resource.
	 * @param organizationId The organization ID
	 * @param resourceType Resource type
	 * @param resourceId Resource ID
	 */
	unshareResource(organizationId: string, resourceType: string, resourceId: string): void;

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when organization changes.
	 */
	onDidOrganizationChange: Event<{ organizationId: string; changeType: 'joined' | 'left' | 'updated' }>;

	/**
	 * Event fired when team changes.
	 */
	onDidTeamChange: Event<{ teamId: string }>;
}
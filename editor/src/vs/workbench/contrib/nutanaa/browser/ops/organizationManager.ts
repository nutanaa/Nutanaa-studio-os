/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IOrganization, ITeam, ITeamMembership } from '../../models/enterpriseModel.js';
import { IOrganizationManager } from '../../common/ops/organizationManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../../common/runtime/runtimeEventBus.js';
import { IRuntimeStateService } from '../../common/runtime/runtimeState.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';

/**
 * OrganizationManager implementation for Nutanaa Studio OS Enterprise.
 *
 * Manages organizations, teams, and user collaboration.
 */
export class OrganizationManager extends Disposable implements IOrganizationManager {

	declare readonly _serviceBrand: undefined;

	private readonly organizations = new Map<string, IOrganization>();
	private readonly teams = new Map<string, ITeam>();
	private readonly teamMemberships = new Map<string, ITeamMembership[]>();
	private readonly sharedResources = new Map<string, Map<string, Map<string, { read: string[]; write: string[] }>>>();

	private currentOrganizationId: string | undefined;

	private readonly _onDidOrganizationChange = this._register(new Emitter<{ organizationId: string; changeType: 'joined' | 'left' | 'updated' }>());
	private readonly _onDidTeamChange = this._register(new Emitter<{ teamId: string }>());

	public readonly onDidOrganizationChange = this._onDidOrganizationChange.event;
	public readonly onDidTeamChange = this._onDidTeamChange.event;

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.loadData();
	}

	// ── Organization Management ───────────────────────────────────────────────

	getCurrentOrganization(): IOrganization | undefined {
		if (!this.currentOrganizationId) {
			return undefined;
		}
		return this.organizations.get(this.currentOrganizationId);
	}

	getOrganization(organizationId: string): IOrganization | undefined {
		return this.organizations.get(organizationId);
	}

	getMyOrganizations(): IOrganization[] {
		return Array.from(this.organizations.values());
	}

	async createOrganization(
		data: {
			name: string;
			description?: string;
			settings?: IOrganization['settings'];
		},
		createdBy: string
	): Promise<IOrganization> {
		const slug = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
		const organizationId = `org-${Date.now()}-${Math.random().toString(36).slice(2)}`;

		const organization: IOrganization = {
			id: organizationId,
			name: data.name,
			slug,
			description: data.description,
			settings: data.settings || {
				defaultRole: 'Developer',
				mfaRequired: false,
				allowedAuthProviders: ['local', 'oauth2'],
			},
			createdAt: Date.now(),
			createdBy,
		};

		this.organizations.set(organizationId, organization);
		this.currentOrganizationId = organizationId;

		// Initialize team memberships for this org
		this.teamMemberships.set(organizationId, []);

		// Create default team
		await this.createTeam({
			organizationId,
			name: 'Owners',
			description: 'Organization owners with full access',
			memberIds: [createdBy],
			roleIds: ['role-admin'],
		});

		this.saveData();
		this.updateOrganizationState();

		this.runtimeEventBus.fire({
			type: RuntimeEventType.OrganizationChanged,
			timestamp: Date.now(),
			payload: {
				organizationId,
				changeType: 'joined',
			},
		});

		this.logService.info(`Organization ${data.name} created by ${createdBy}`);

		return organization;
	}

	async updateOrganization(organizationId: string, updates: Partial<IOrganization>): Promise<void> {
		const organization = this.organizations.get(organizationId);
		if (!organization) {
			throw new Error(`Organization ${organizationId} not found`);
		}

		const updated = { ...organization, ...updates };
		this.organizations.set(organizationId, updated);

		this.saveData();
		this.updateOrganizationState();

		this._onDidOrganizationChange.fire({ organizationId, changeType: 'updated' });

		this.logService.info(`Organization ${organizationId} updated`);
	}

	async deleteOrganization(organizationId: string): Promise<void> {
		const organization = this.organizations.get(organizationId);
		if (!organization) {
			return;
		}

		// Delete all teams
		for (const team of this.teams.values()) {
			if (team.organizationId === organizationId) {
				this.teams.delete(team.id);
			}
		}

		// Delete membership data
		this.teamMemberships.delete(organizationId);
		this.sharedResources.delete(organizationId);

		// Delete organization
		this.organizations.delete(organizationId);

		if (this.currentOrganizationId === organizationId) {
			this.currentOrganizationId = undefined;
		}

		this.saveData();
		this.updateOrganizationState();

		this.logService.info(`Organization ${organization.name} deleted`);
	}

	async joinOrganization(organizationId: string, userId: string): Promise<void> {
		const organization = this.organizations.get(organizationId);
		if (!organization) {
			throw new Error(`Organization ${organizationId} not found`);
		}

		const memberships = this.teamMemberships.get(organizationId) || [];
		memberships.push({
			teamId: '', // Will be assigned to a default team
			userId,
			role: 'Viewer',
			joinedAt: Date.now(),
		});
		this.teamMemberships.set(organizationId, memberships);

		this.currentOrganizationId = organizationId;

		this.saveData();
		this.updateOrganizationState();

		this._onDidOrganizationChange.fire({ organizationId, changeType: 'joined' });

		this.runtimeEventBus.fire({
			type: RuntimeEventType.OrganizationChanged,
			timestamp: Date.now(),
			payload: { organizationId, changeType: 'joined' },
		});

		this.logService.info(`User ${userId} joined organization ${organization.name}`);
	}

	async leaveOrganization(organizationId: string, userId: string): Promise<void> {
		const organization = this.organizations.get(organizationId);
		if (!organization) {
			return;
		}

		const memberships = this.teamMemberships.get(organizationId) || [];
		const filtered = memberships.filter(m => m.userId !== userId);
		this.teamMemberships.set(organizationId, filtered);

		if (this.currentOrganizationId === organizationId) {
			this.currentOrganizationId = undefined;
		}

		this.saveData();
		this.updateOrganizationState();

		this._onDidOrganizationChange.fire({ organizationId, changeType: 'left' });

		this.runtimeEventBus.fire({
			type: RuntimeEventType.OrganizationChanged,
			timestamp: Date.now(),
			payload: { organizationId, changeType: 'left' },
		});

		this.logService.info(`User ${userId} left organization ${organization.name}`);
	}

	// ── Team Management ───────────────────────────────────────────────────────

	getTeams(organizationId: string): ITeam[] {
		return Array.from(this.teams.values()).filter(t => t.organizationId === organizationId);
	}

	getTeam(teamId: string): ITeam | undefined {
		return this.teams.get(teamId);
	}

	async createTeam(teamData: {
		organizationId: string;
		name: string;
		description?: string;
		memberIds?: string[];
		roleIds?: string[];
	}): Promise<ITeam> {
		const teamId = `team-${Date.now()}-${Math.random().toString(36).slice(2)}`;

		const team: ITeam = {
			id: teamId,
			organizationId: teamData.organizationId,
			name: teamData.name,
			description: teamData.description,
			memberIds: teamData.memberIds || [],
			roleIds: teamData.roleIds || [],
			createdAt: Date.now(),
		};

		this.teams.set(teamId, team);

		// Add members
		if (teamData.memberIds) {
			for (const userId of teamData.memberIds) {
				this.addTeamMember(teamId, userId, 'Member');
			}
		}

		this.saveData();

		this._onDidTeamChange.fire({ teamId });

		this.logService.info(`Team ${teamData.name} created in organization ${teamData.organizationId}`);

		return team;
	}

	async updateTeam(teamId: string, updates: Partial<ITeam>): Promise<void> {
		const team = this.teams.get(teamId);
		if (!team) {
			throw new Error(`Team ${teamId} not found`);
		}

		const updated = { ...team, ...updates };
		this.teams.set(teamId, updated);

		this.saveData();

		this._onDidTeamChange.fire({ teamId });

		this.logService.info(`Team ${teamId} updated`);
	}

	async deleteTeam(teamId: string): Promise<void> {
		const team = this.teams.get(teamId);
		if (!team) {
			return;
		}

		this.teams.delete(teamId);

		// Remove membership data
		const memberships = this.teamMemberships.get(team.organizationId) || [];
		const filtered = memberships.filter(m => m.teamId !== teamId);
		this.teamMemberships.set(team.organizationId, filtered);

		this.saveData();

		this._onDidTeamChange.fire({ teamId });

		this.logService.info(`Team ${team.name} deleted`);
	}

	// ── Team Membership ───────────────────────────────────────────────────────

	addTeamMember(teamId: string, userId: string, role: string): void {
		const team = this.teams.get(teamId);
		if (!team) {
			throw new Error(`Team ${teamId} not found`);
		}

		if (!team.memberIds.includes(userId)) {
			const updatedTeam = { ...team, memberIds: [...team.memberIds, userId] };
			this.teams.set(teamId, updatedTeam);
		}

		// Update membership record
		const memberships = this.teamMemberships.get(team.organizationId) || [];
		const existing = memberships.find(m => m.userId === userId && m.teamId === teamId);
		if (!existing) {
			memberships.push({
				teamId,
				userId,
				role,
				joinedAt: Date.now(),
			});
			this.teamMemberships.set(team.organizationId, memberships);
		}

		this.saveData();
		this._onDidTeamChange.fire({ teamId });

		this.logService.info(`User ${userId} added to team ${team.name}`);
	}

	removeTeamMember(teamId: string, userId: string): void {
		const team = this.teams.get(teamId);
		if (!team) {
			return;
		}

		const updatedTeam = { ...team, memberIds: team.memberIds.filter(id => id !== userId) };
		this.teams.set(teamId, updatedTeam);

		// Remove membership record
		const memberships = this.teamMemberships.get(team.organizationId) || [];
		const filtered = memberships.filter(m => !(m.userId === userId && m.teamId === teamId));
		this.teamMemberships.set(team.organizationId, filtered);

		this.saveData();
		this._onDidTeamChange.fire({ teamId });

		this.logService.info(`User ${userId} removed from team ${team.name}`);
	}

	updateTeamMemberRole(teamId: string, userId: string, role: string): void {
		const team = this.teams.get(teamId);
		if (!team) {
			return;
		}

		const memberships = this.teamMemberships.get(team.organizationId) || [];
		const membership = memberships.find(m => m.userId === userId && m.teamId === teamId);
		if (membership) {
			const updatedMembership = { ...membership, role };
			const updatedMemberships = memberships.map(m => (m.userId === userId && m.teamId === teamId ? updatedMembership : m));
			this.teamMemberships.set(team.organizationId, updatedMemberships);
		}

		this.saveData();
		this._onDidTeamChange.fire({ teamId });

		this.logService.info(`User ${userId} role updated to ${role} in team ${team.name}`);
	}

	getUserTeamMemberships(userId: string): ITeamMembership[] {
		const memberships: ITeamMembership[] = [];

		for (const [, orgMemberships] of this.teamMemberships) {
			memberships.push(...orgMemberships.filter(m => m.userId === userId));
		}

		return memberships;
	}

	// ── Shared Resources ───────────────────────────────────────────────────────

	getSharedResources(organizationId: string): Map<string, Array<{ id: string; name: string; type: string }>> {
		const orgResources = this.sharedResources.get(organizationId);
		if (!orgResources) {
			return new Map();
		}

		const result = new Map<string, Array<{ id: string; name: string; type: string }>>();

		for (const [resourceType, resources] of orgResources) {
			const resourceList: Array<{ id: string; name: string; type: string }> = [];
			for (const [resourceId] of resources) {
				resourceList.push({ id: resourceId, name: resourceId, type: resourceType });
			}
			result.set(resourceType, resourceList);
		}

		return result;
	}

	shareResource(
		organizationId: string,
		resourceType: string,
		resourceId: string,
		permissions: { read: string[]; write: string[] }
	): void {
		let orgResources = this.sharedResources.get(organizationId);
		if (!orgResources) {
			orgResources = new Map();
			this.sharedResources.set(organizationId, orgResources);
		}

		let typeResources = orgResources.get(resourceType);
		if (!typeResources) {
			typeResources = new Map();
			orgResources.set(resourceType, typeResources);
		}

		typeResources.set(resourceId, permissions);

		this.saveData();
		this.logService.info(`Resource ${resourceType}/${resourceId} shared with organization ${organizationId}`);
	}

	unshareResource(organizationId: string, resourceType: string, resourceId: string): void {
		const orgResources = this.sharedResources.get(organizationId);
		if (!orgResources) {
			return;
		}

		const typeResources = orgResources.get(resourceType);
		if (!typeResources) {
			return;
		}

		typeResources.delete(resourceId);

		this.saveData();
		this.logService.info(`Resource ${resourceType}/${resourceId} unshared from organization ${organizationId}`);
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private updateOrganizationState(): void {
		const currentOrg = this.getCurrentOrganization();

		this.runtimeStateService.update({
			enterprise: {
				currentUser: undefined,
				currentOrganization: currentOrg,
				session: undefined,
				isAuthenticated: false,
				userPermissions: [],
				userRoles: [],
				organizationTeamIds: currentOrg
					? this.getTeams(currentOrg.id).map(t => t.id)
					: [],
			},
		});
	}

	private loadData(): void {
		const stored = this.storageService.get('nutanaa.organizations', StorageScope.APPLICATION);
		if (stored) {
			try {
				const data = JSON.parse(stored) as {
					organizations: Record<string, IOrganization>;
					teams: Record<string, ITeam>;
					memberships: Record<string, ITeamMembership[]>;
					sharedResources: Record<string, Record<string, Record<string, { read: string[]; write: string[] }>>>;
					currentOrganizationId?: string;
				};
				for (const [id, org] of Object.entries(data.organizations || {})) {
					this.organizations.set(id, org as IOrganization);
				}
				for (const [id, team] of Object.entries(data.teams || {})) {
					this.teams.set(id, team as ITeam);
				}
				for (const [orgId, memberships] of Object.entries(data.memberships || {})) {
					this.teamMemberships.set(orgId, memberships as ITeamMembership[]);
				}
			for (const [orgId, resources] of Object.entries(data.sharedResources || {})) {
				const orgResources = new Map<string, Map<string, { read: string[]; write: string[] }>>();
				const resourcesObj = resources as Record<string, Record<string, { read: string[]; write: string[] }>>;
				for (const [type, typeResources] of Object.entries(resourcesObj)) {
					const typedResources = new Map(Object.entries(typeResources) as Array<[string, { read: string[]; write: string[] }]>);
					orgResources.set(type, typedResources);
				}
				this.sharedResources.set(orgId, orgResources);
			}
				this.currentOrganizationId = data.currentOrganizationId;
			} catch {
				this.organizations.clear();
				this.teams.clear();
				this.teamMemberships.clear();
				this.sharedResources.clear();
			}
		}
	}

	private saveData(): void {
		const orgsObj: Record<string, IOrganization> = {};
		for (const [id, org] of this.organizations) {
			orgsObj[id] = org;
		}

		const teamsObj: Record<string, ITeam> = {};
		for (const [id, team] of this.teams) {
			teamsObj[id] = team;
		}

		const membershipsObj: Record<string, ITeamMembership[]> = {};
		for (const [orgId, memberships] of this.teamMemberships) {
			membershipsObj[orgId] = memberships;
		}

		const resourcesObj: Record<string, Record<string, Record<string, { read: string[]; write: string[] }>>> = {};
		for (const [orgId, orgResources] of this.sharedResources) {
			resourcesObj[orgId] = {};
			for (const [type, typeResources] of orgResources) {
				resourcesObj[orgId][type] = Object.fromEntries(typeResources);
			}
		}

		this.storageService.store('nutanaa.organizations', JSON.stringify({
			organizations: orgsObj,
			teams: teamsObj,
			memberships: membershipsObj,
			sharedResources: resourcesObj,
			currentOrganizationId: this.currentOrganizationId,
		}), StorageScope.APPLICATION, StorageTarget.MACHINE);
	}
}
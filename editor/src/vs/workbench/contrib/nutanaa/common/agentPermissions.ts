// File: src/vs/workbench/contrib/nutanaa/common/agentPermissions.ts

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IAgentPermissionRequest } from '../models/agentModel.js';

export class AgentPermissionsManager extends Disposable {
	private readonly pendingRequests = new Map<string, IAgentPermissionRequest>();
	private readonly grantedPermissions = new Set<string>();

	public createRequest(agentId: string, resource: string, action: string, reason: string): IAgentPermissionRequest {
		const req: IAgentPermissionRequest = {
			id: `perm_${agentId}_${Date.now()}`,
			agentId,
			resource,
			action,
			reason,
			timestamp: Date.now(),
			status: 'pending'
		};
		this.pendingRequests.set(req.id, req);
		return req;
	}

	public resolveRequest(requestId: string, approve: boolean): boolean {
		const req = this.pendingRequests.get(requestId);
		if (!req) {
			return false;
		}

		if (approve) {
			this.grantedPermissions.add(`${req.agentId}:${req.resource}:${req.action}`);
		}
		this.pendingRequests.delete(requestId);
		return approve;
	}

	public isGranted(agentId: string, resource: string, action: string): boolean {
		return this.grantedPermissions.has(`${agentId}:${resource}:${action}`);
	}

	public getPendingRequests(): IAgentPermissionRequest[] {
		return Array.from(this.pendingRequests.values());
	}
}
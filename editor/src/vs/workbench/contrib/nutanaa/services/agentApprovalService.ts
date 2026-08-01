/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { AgentPermissionsManager } from '../common/agentPermissions.js';
import { IAgentPermissionRequest } from '../models/agentModel.js';

export const IAgentApprovalService = createDecorator<IAgentApprovalService>('agentApprovalService');

export interface IAgentApprovalService {
	readonly _serviceBrand: undefined;
	requestApproval(agentId: string, resource: string, action: string, reason: string): IAgentPermissionRequest;
	resolveApproval(requestId: string, approve: boolean): boolean;
}

export class AgentApprovalService extends Disposable implements IAgentApprovalService {
	declare readonly _serviceBrand: undefined;

	private readonly permissionsManager = this._register(new AgentPermissionsManager());

	public requestApproval(agentId: string, resource: string, action: string, reason: string): IAgentPermissionRequest {
		return this.permissionsManager.createRequest(agentId, resource, action, reason);
	}

	public resolveApproval(requestId: string, approve: boolean): boolean {
		return this.permissionsManager.resolveRequest(requestId, approve);
	}
}

// File: src/vs/workbench/contrib/nutanaa/services/agentRecoveryService.ts

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IAgentStateService } from '../common/agentStateService.js';

export const IAgentRecoveryService = createDecorator<IAgentRecoveryService>('agentRecoveryService');

export interface IAgentRecoveryService {
	readonly _serviceBrand: undefined;
	attemptRecovery(agentId: string): Promise<boolean>;
}

export class AgentRecoveryService extends Disposable implements IAgentRecoveryService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IAgentStateService private readonly stateService: IAgentStateService
	) {
		super();
	}

	public async attemptRecovery(agentId: string): Promise<boolean> {
		const state = this.stateService.getAgentState(agentId);
		if (!state) {
			return false;
		}

		this.stateService.updateAgentState(agentId, { status: 'recovering' });
		this.stateService.updateAgentState(agentId, { status: 'idle', error: undefined });
		return true;
	}
}
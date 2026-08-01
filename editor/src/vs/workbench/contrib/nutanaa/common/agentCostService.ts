// File: src/vs/workbench/contrib/nutanaa/common/agentCostService.ts

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IAgentStateService } from '../common/agentStateService.js';


export const IAgentCostService = createDecorator<IAgentCostService>('agentCostService');

export interface IAgentCostService {
	readonly _serviceBrand: undefined;
	recordUsage(agentId: string, tokens: number, costUsd: number): void;
	getTotalCost(): number;
	getAgentCost(agentId: string): number;
}

export class AgentCostService extends Disposable implements IAgentCostService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IAgentStateService private readonly stateService: IAgentStateService
	) {
		super();
	}

	public recordUsage(agentId: string, tokens: number, costUsd: number): void {
		const state = this.stateService.getAgentState(agentId);
		if (state) {
			this.stateService.updateAgentState(agentId, {
				totalCostUsd: state.totalCostUsd + costUsd,
				totalTokensUsed: state.totalTokensUsed + tokens
			});
		}
	}

	public getTotalCost(): number {
		return this.stateService.getAllAgentStates().reduce((sum, s) => sum + s.totalCostUsd, 0);
	}

	public getAgentCost(agentId: string): number {
		return this.stateService.getAgentState(agentId)?.totalCostUsd || 0;
	}
}
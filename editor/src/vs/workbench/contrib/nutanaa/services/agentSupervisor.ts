/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IAgentStateService } from '../common/agents/agentStateService.js';
import { IAgentHealthService } from '../common/agents/agentHealthService.js';

export const IAgentSupervisor = createDecorator<IAgentSupervisor>('agentSupervisor');

export interface IAgentSupervisor {
	readonly _serviceBrand: undefined;
	supervise(): void;
}

export class AgentSupervisor extends Disposable implements IAgentSupervisor {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IAgentStateService private readonly stateService: IAgentStateService,
		@IAgentHealthService private readonly healthService: IAgentHealthService
	) {
		super();
	}

	public supervise(): void {
		const states = this.stateService.getAllAgentStates();
		const healthProvider = this.healthService as unknown as { getHealthStatus: (agentId: string) => { unresponsive: boolean } | undefined };

		for (const state of states) {
			const isUnresponsive = typeof healthProvider.getHealthStatus === 'function'
				? healthProvider.getHealthStatus(state.id)?.unresponsive
				: false;

			if (state.status === 'running' && (state.totalCostUsd > state.config.maxBudgetUsd || isUnresponsive)) {
				this.stateService.updateAgentState(state.id, {
					status: 'paused',
					error: 'Exceeded assigned dollar budget cap or health check failed'
				});
			}
		}
	}
}

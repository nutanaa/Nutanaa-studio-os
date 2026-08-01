// File: src/vs/workbench/contrib/nutanaa/services/agentWatchdog.ts

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IAgentStateService } from '../common/agentStateService.js';

export const IAgentWatchdog = createDecorator<IAgentWatchdog>('agentWatchdog');

export interface IAgentWatchdog {
	readonly _serviceBrand: undefined;
	checkHealth(): void;
}

export class AgentWatchdog extends Disposable implements IAgentWatchdog {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IAgentStateService private readonly stateService: IAgentStateService
	) {
		super();
	}

	public checkHealth(): void {
		const states = this.stateService.getAllAgentStates();
		const now = Date.now();
		for (const state of states) {
			if (state.status === 'running' && (now - state.lastHeartbeat > 30000)) {
				this.stateService.updateAgentState(state.id, {
					status: 'failed',
					error: 'Agent process unresponsive (Watchdog timeout)'
				});
			}
		}
	}
}
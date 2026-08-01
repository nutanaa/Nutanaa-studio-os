// File: src/vs/workbench/contrib/nutanaa/common/agentRuntime.ts

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IAgentStateService } from '../common/agentStateService.js';

export class AgentRuntime extends Disposable {
	private isInitialized = false;

	constructor(
		@IAgentStateService private readonly stateService: IAgentStateService
	) {
		super();
	}

	public initialize(): void {
		if (this.isInitialized) {
			return;
		}
		this.isInitialized = true;
	}

	public getStatus(): { isInitialized: boolean; activeAgents: number } {
		return {
			isInitialized: this.isInitialized,
			activeAgents: this.stateService.getAllAgentStates().length
		};
	}
}
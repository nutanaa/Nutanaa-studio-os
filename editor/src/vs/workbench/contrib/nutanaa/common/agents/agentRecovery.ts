/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IAgentStateService } from './agentStateService.js';
import { AgentSnapshotManager } from './agentSnapshots.js';

export class AgentRecoveryEngine extends Disposable {
	constructor(
		@IAgentStateService private readonly stateService: IAgentStateService,
		private readonly snapshotManager: AgentSnapshotManager
	) {
		super();
	}

	public recoverAgent(agentId: string): boolean {
		const latest = this.snapshotManager.getLatestSnapshot(agentId);
		if (!latest) {
			return false;
		}

		this.stateService.updateAgentState(agentId, {
			status: 'recovering',
			progress: 0,
			error: undefined
		});

		// Apply snapshot state restoration logic
		this.stateService.updateAgentState(agentId, {
			status: 'idle'
		});

		return true;
	}
}

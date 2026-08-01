// File: src/vs/workbench/contrib/nutanaa/common/agentRollback.ts

import { Disposable } from '../../../../base/common/lifecycle.js';
import { AgentSnapshotManager } from '../common/agentSnapshots.js';
import { IAgentCheckpointData } from '../models/agentHistoryModel.js';

export class AgentRollbackManager extends Disposable {
	constructor(private readonly snapshotManager: AgentSnapshotManager) {
		super();
	}

	public rollbackToStep(agentId: string, stepIndex: number): IAgentCheckpointData | undefined {
		const snapshots = this.snapshotManager.getSnapshots(agentId);
		const target = snapshots.find(s => s.stepIndex === stepIndex);
		if (!target) {
			return undefined;
		}

		return target;
	}
}
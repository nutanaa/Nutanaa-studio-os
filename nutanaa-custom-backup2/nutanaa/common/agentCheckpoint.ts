// File: src/vs/workbench/contrib/nutanaa/common/agentCheckpoint.ts

import { Disposable } from '../../../../base/common/lifecycle.js';
import { AgentSnapshotManager } from '../common/agentSnapshots.js';

export class AgentCheckpointService extends Disposable {
	constructor(private readonly snapshotManager: AgentSnapshotManager) {
		super();
	}

	public saveCheckpoint(agentId: string, stepIndex: number, state: Record<string, any>, memory: any[]): void {
		this.snapshotManager.createSnapshot(agentId, stepIndex, state, memory);
	}
}
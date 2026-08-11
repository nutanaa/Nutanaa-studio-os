/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IAgentCheckpointData } from '../../models/agentHistoryModel.js';

export class AgentSnapshotManager extends Disposable {
	private readonly snapshots = new Map<string, IAgentCheckpointData[]>();

	public createSnapshot(agentId: string, stepIndex: number, stateSnapshot: Record<string, unknown>, memorySnapshot: unknown[]): IAgentCheckpointData {
		const checkpoint: IAgentCheckpointData = {
			checkpointId: `snap_${agentId}_${Date.now()}`,
			agentId,
			timestamp: Date.now(),
			stepIndex,
			stateSnapshot,
			memorySnapshot
		};

		const list = this.snapshots.get(agentId) || [];
		list.push(checkpoint);
		this.snapshots.set(agentId, list);
		return checkpoint;
	}

	public getSnapshots(agentId: string): IAgentCheckpointData[] {
		return this.snapshots.get(agentId) || [];
	}

	public getLatestSnapshot(agentId: string): IAgentCheckpointData | undefined {
		const list = this.getSnapshots(agentId);
		return list.length > 0 ? list[list.length - 1] : undefined;
	}

	public clearSnapshots(agentId: string): void {
		this.snapshots.delete(agentId);
	}
}

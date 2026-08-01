/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { AgentSnapshotManager } from '../common/agentSnapshots.js';

export class AgentCheckpointService extends Disposable {
	constructor(private readonly snapshotManager: AgentSnapshotManager) {
		super();
	}

	public saveCheckpoint(agentId: string, stepIndex: number, state: Record<string, unknown>, memory: unknown[]): void {
		this.snapshotManager.createSnapshot(agentId, stepIndex, state, memory);
	}
}

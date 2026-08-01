/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMemoryEntry } from '../../models/memoryModel.js';

export class AgentMemory {
	private readonly memoryStore: Map<string, IMemoryEntry> = new Map();

	public recordAgentState(agentId: string, action: string, outcome: string, metadata?: Record<string, unknown>): IMemoryEntry {
		const now = Date.now();
		const key = `agent_${agentId}_${now}`;
		const entry: IMemoryEntry = {
			id: `agent_mem_${now}`,
			type: 'agent',
			key,
			content: `Action: ${action} | Outcome: ${outcome}`,
			tags: [agentId, action],
			timestamp: now,
			lastAccessedTimestamp: now,
			accessCount: 1,
			score: 1.0,
			metadata
		};

		this.memoryStore.set(key, entry);
		return entry;
	}

	public getAgentHistory(agentId: string): IMemoryEntry[] {
		return Array.from(this.memoryStore.values()).filter(entry => entry.tags.includes(agentId));
	}

	public clear(): void {
		this.memoryStore.clear();
	}
}

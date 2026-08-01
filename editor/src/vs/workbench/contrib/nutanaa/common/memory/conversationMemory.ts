// File: src/vs/workbench/contrib/nutanaa/common/memory/conversationMemory.ts

import { IMemoryEntry } from '../../models/memoryModel.js';

export class ConversationMemory {
	private readonly history: IMemoryEntry[] = [];

	public addTurn(role: 'user' | 'assistant' | 'system', text: string, metadata?: Record<string, any>): IMemoryEntry {
		const now = Date.now();
		const entry: IMemoryEntry = {
			id: `conv_${now}_${this.history.length}`,
			type: 'conversation',
			key: `turn_${this.history.length}`,
			content: `${role}: ${text}`,
			tags: [role],
			timestamp: now,
			lastAccessedTimestamp: now,
			accessCount: 1,
			score: 1.0,
			metadata
		};

		this.history.push(entry);
		return entry;
	}

	public getRecentTurns(limit: number = 10): IMemoryEntry[] {
		return this.history.slice(-limit);
	}

	public getAllTurns(): IMemoryEntry[] {
		return [...this.history];
	}

	public clear(): void {
		this.history.length = 0;
	}
}
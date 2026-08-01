/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMemoryEntry } from '../../models/memoryModel.js';

export class KnowledgeMemory {
	private readonly knowledgeBase: Map<string, IMemoryEntry> = new Map();

	public addKnowledge(topic: string, description: string, tags: string[] = []): IMemoryEntry {
		const now = Date.now();
		const entry: IMemoryEntry = {
			id: `know_${now}_${Math.random().toString(36).substring(2, 6)}`,
			type: 'knowledge',
			key: topic,
			content: description,
			tags: ['knowledge', ...tags],
			timestamp: now,
			lastAccessedTimestamp: now,
			accessCount: 1,
			score: 1.0
		};

		this.knowledgeBase.set(topic, entry);
		return entry;
	}

	public searchByTag(tag: string): IMemoryEntry[] {
		return Array.from(this.knowledgeBase.values()).filter(entry => entry.tags.includes(tag));
	}

	public getAllKnowledge(): IMemoryEntry[] {
		return Array.from(this.knowledgeBase.values());
	}
}

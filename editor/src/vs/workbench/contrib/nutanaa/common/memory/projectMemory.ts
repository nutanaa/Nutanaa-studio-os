/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMemoryEntry } from '../../models/memoryModel.js';

export class ProjectMemory {
	private readonly projectFacts: Map<string, IMemoryEntry> = new Map();

	public setFact(key: string, fact: string, category: string): IMemoryEntry {
		const now = Date.now();
		const entry: IMemoryEntry = {
			id: `proj_${key}_${now}`,
			type: 'project',
			key,
			content: fact,
			tags: ['project-fact', category],
			timestamp: now,
			lastAccessedTimestamp: now,
			accessCount: 1,
			score: 1.0
		};

		this.projectFacts.set(key, entry);
		return entry;
	}

	public getFact(key: string): IMemoryEntry | undefined {
		return this.projectFacts.get(key);
	}

	public getAllFacts(): IMemoryEntry[] {
		return Array.from(this.projectFacts.values());
	}

	public removeFact(key: string): boolean {
		return this.projectFacts.delete(key);
	}
}

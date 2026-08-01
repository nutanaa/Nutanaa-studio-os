/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMemoryEntry } from '../../models/memoryModel.js';

export class WorkspaceMemory {
	private readonly entries: Map<string, IMemoryEntry> = new Map();

	public store(key: string, content: string, tags: string[] = [], metadata?: Record<string, unknown>): IMemoryEntry {
		const now = Date.now();
		const entry: IMemoryEntry = {
			id: `ws_mem_${now}_${Math.random().toString(36).substring(2, 7)}`,
			type: 'workspace',
			key,
			content,
			tags,
			timestamp: now,
			lastAccessedTimestamp: now,
			accessCount: 1,
			score: 1.0,
			metadata
		};

		this.entries.set(key, entry);
		return entry;
	}

	public get(key: string): IMemoryEntry | undefined {
		const entry = this.entries.get(key);
		if (entry) {
			const updated: IMemoryEntry = {
				...entry,
				lastAccessedTimestamp: Date.now(),
				accessCount: entry.accessCount + 1
			};
			this.entries.set(key, updated);
			return updated;
		}
		return undefined;
	}

	public getAll(): IMemoryEntry[] {
		return Array.from(this.entries.values());
	}

	public delete(key: string): boolean {
		return this.entries.delete(key);
	}

	public clear(): void {
		this.entries.clear();
	}
}

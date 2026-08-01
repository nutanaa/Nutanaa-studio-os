// File: src/vs/workbench/contrib/nutanaa/common/memory/memoryCleanup.ts

import { IMemoryEntry } from '../../models/memoryModel.js';

export class MemoryCleanup {
	public static prune(entries: IMemoryEntry[], maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): IMemoryEntry[] {
		const now = Date.now();
		return entries.filter(entry => {
			const age = now - entry.lastAccessedTimestamp;
			return age <= maxAgeMs;
		});
	}
}
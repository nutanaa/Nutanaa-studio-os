// File: src/vs/workbench/contrib/nutanaa/common/memory/memoryPersistence.ts

import { IMemoryEntry } from '../../models/memoryModel.js';

export class MemoryPersistence {
	public serialize(entries: IMemoryEntry[]): string {
		return JSON.stringify(entries, null, 2);
	}

	public deserialize(json: string): IMemoryEntry[] {
		try {
			const parsed = JSON.parse(json);
			if (Array.isArray(parsed)) {
				return parsed as IMemoryEntry[];
			}
			return [];
		} catch {
			return [];
		}
	}
}
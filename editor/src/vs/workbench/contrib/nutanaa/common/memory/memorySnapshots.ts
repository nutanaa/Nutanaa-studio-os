// File: src/vs/workbench/contrib/nutanaa/common/memory/memorySnapshots.ts

import { IMemoryEntry, IMemorySnapshot } from '../../models/memoryModel.js';

export class MemorySnapshots {
	private readonly snapshots: Map<string, IMemorySnapshot> = new Map();

	public createSnapshot(entries: IMemoryEntry[]): IMemorySnapshot {
		const now = Date.now();
		const id = `snap_${now}`;
		const snapshot: IMemorySnapshot = {
			id,
			timestamp: now,
			entriesCount: entries.length,
			data: JSON.parse(JSON.stringify(entries))
		};

		this.snapshots.set(id, snapshot);
		return snapshot;
	}

	public getSnapshot(id: string): IMemorySnapshot | undefined {
		return this.snapshots.get(id);
	}

	public listSnapshots(): IMemorySnapshot[] {
		return Array.from(this.snapshots.values());
	}
}
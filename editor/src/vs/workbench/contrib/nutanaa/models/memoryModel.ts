// File: src/vs/workbench/contrib/nutanaa/models/memoryModel.ts

export type MemoryType = 'workspace' | 'conversation' | 'agent' | 'project' | 'knowledge';

export interface IMemoryEntry {
	readonly id: string;
	readonly type: MemoryType;
	readonly key: string;
	readonly content: string;
	readonly tags: string[];
	readonly timestamp: number;
	readonly lastAccessedTimestamp: number;
	readonly accessCount: number;
	readonly score: number;
	readonly metadata?: Record<string, any>;
}

export interface IMemoryQuery {
	readonly query: string;
	readonly types?: MemoryType[];
	readonly tags?: string[];
	readonly limit?: number;
	readonly minScore?: number;
}

export interface IMemorySearchResult {
	readonly entry: IMemoryEntry;
	readonly relevanceScore: number;
}

export interface IMemorySnapshot {
	readonly id: string;
	readonly timestamp: number;
	readonly entriesCount: number;
	readonly data: IMemoryEntry[];
}
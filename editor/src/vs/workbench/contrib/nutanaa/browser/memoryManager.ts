/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Promises } from '../../../../base/common/async.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import {
	MemoryStorageType,
	IMemoryEntry,
	IMemorySearchOptions,
	IMemorySearchResult,
	IMemoryStats,
} from '../models/aiCore.js';
import { IMemoryManager } from '../common/memoryManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../common/runtimeEventBus.js';
import { IRuntimeStateService } from '../common/runtimeState.js';

interface MemoryStorage {
	[id: string]: IMemoryEntry;
}

/**
 * MemoryManager implementation for Nutanaa Studio OS.
 *
 * Manages memories for all types with search, compression,
 * and expiration capabilities.
 */
export class MemoryManager extends Disposable implements IMemoryManager {

	declare readonly _serviceBrand: undefined;

	private memories: MemoryStorage = {};
	private readonly memoryOrder: string[] = [];

	private readonly _onDidChangeMemory = this._register(new Emitter<{ memoryId: string; operation: 'create' | 'update' | 'delete' }>());

	public readonly onDidChangeMemory = Event.fromEmitter(this._onDidChangeMemory);

	private readonly COMPRESSION_THRESHOLD = 7 * 24 * 60 * 60 * 1000; // 7 days
	private readonly MAX_MEMORIES = 10000;

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	// ── Memory CRUD ────────────────────────────────────────────────────────────

	createMemory(entry: Omit<IMemoryEntry, 'id' | 'timestamp' | 'lastAccessedTimestamp' | 'accessCount'>): string {
		const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2)}`;

		const memory: IMemoryEntry = {
			...entry,
			id,
			timestamp: Date.now(),
			lastAccessedTimestamp: Date.now(),
			accessCount: 0,
		};

		this.memories[id] = memory;
		this.memoryOrder.push(id);

		// Update runtime state
		this.runtimeStateService.updateProviders({
			memoryUpdates: {
				added: [memory],
			},
		});

		// Fire event
		this._onDidChangeMemory.fire({ memoryId: id, operation: 'create' });
		this.runtimeEventBus.fire({
			type: RuntimeEventType.MemoryUpdated,
			timestamp: Date.now(),
			payload: {
				memoryId: id,
				memoryType: memory.type,
				operation: 'create',
				entryCount: this.memoryOrder.length,
			},
		});

		this.logService.debug(`Memory created: ${id} (${memory.type})`);
		return id;
	}

	getMemory(memoryId: string): IMemoryEntry | undefined {
		return this.memories[memoryId];
	}

	updateMemory(memoryId: string, updates: Partial<IMemoryEntry>): boolean {
		const memory = this.memories[memoryId];
		if (!memory) {
			this.logService.warn(`Memory ${memoryId} not found for update`);
			return false;
		}

		const updated: IMemoryEntry = {
			...memory,
			...updates,
			id: memory.id, // Prevent ID change
			timestamp: memory.timestamp, // Preserve original timestamp
		};

		this.memories[memoryId] = updated;

		// Update runtime state
		this.runtimeStateService.updateProviders({
			memoryUpdates: {
				updated: [updated],
			},
		});

		// Fire event
		this._onDidChangeMemory.fire({ memoryId, operation: 'update' });
		this.runtimeEventBus.fire({
			type: RuntimeEventType.MemoryUpdated,
			timestamp: Date.now(),
			payload: {
				memoryId,
				memoryType: updated.type,
				operation: 'update',
				entryCount: this.memoryOrder.length,
			},
		});

		this.logService.debug(`Memory updated: ${memoryId}`);
		return true;
	}

	deleteMemory(memoryId: string): boolean {
		const memory = this.memories[memoryId];
		if (!memory) {
			this.logService.warn(`Memory ${memoryId} not found for deletion`);
			return false;
		}

		delete this.memories[memoryId];
		const orderIndex = this.memoryOrder.indexOf(memoryId);
		if (orderIndex !== -1) {
			this.memoryOrder.splice(orderIndex, 1);
		}

		// Update runtime state
		this.runtimeStateService.updateProviders({
			memoryUpdates: {
				deleted: [memoryId],
			},
		});

		// Fire event
		this._onDidChangeMemory.fire({ memoryId, operation: 'delete' });
		this.runtimeEventBus.fire({
			type: RuntimeEventType.MemoryUpdated,
			timestamp: Date.now(),
			payload: {
				memoryId,
				memoryType: memory.type,
				operation: 'delete',
				entryCount: this.memoryOrder.length,
			},
		});

		this.logService.debug(`Memory deleted: ${memoryId}`);
		return true;
	}

	deleteMemoriesByType(type: MemoryStorageType): number {
		const toDelete: string[] = [];

		for (const [id, memory] of Object.entries(this.memories)) {
			if (memory.type === type) {
				toDelete.push(id);
			}
		}

		for (const id of toDelete) {
			delete this.memories[id];
			const orderIndex = this.memoryOrder.indexOf(id);
			if (orderIndex !== -1) {
				this.memoryOrder.splice(orderIndex, 1);
			}
		}

		// Update runtime state
		this.runtimeStateService.updateProviders({
			memoryUpdates: {
				cleared: type,
			},
		});

		this.logService.info(`Deleted ${toDelete} memories of type ${type}`);
		return toDelete.length;
	}

	deleteMemoriesByTag(tag: string): number {
		const toDelete: string[] = [];

		for (const [id, memory] of Object.entries(this.memories)) {
			if (memory.tags.includes(tag)) {
				toDelete.push(id);
			}
		}

		for (const id of toDelete) {
			delete this.memories[id];
			const orderIndex = this.memoryOrder.indexOf(id);
			if (orderIndex !== -1) {
				this.memoryOrder.splice(orderIndex, 1);
			}
		}

		this.logService.info(`Deleted ${toDelete.length} memories with tag ${tag}`);
		return toDelete.length;
	}

	// ── Memory Search ─────────────────────────────────────────────────────────

	async searchMemories(query: string, options: IMemorySearchOptions): Promise<IMemorySearchResult[]> {
		const queryLower = query.toLowerCase();
		const results: Array<IMemorySearchResult & { score: number }> = [];

		for (const [id, memory] of Object.entries(this.memories)) {
			// Filter by type
			if (options.types && options.types.length > 0 && !options.types.includes(memory.type)) {
				continue;
			}

			// Filter by tags
			if (options.tags && options.tags.length > 0 && !options.tags.some(t => memory.tags.includes(t))) {
				continue;
			}

			// Filter by age
			if (options.maxAgeMs) {
				const age = Date.now() - memory.timestamp;
				if (age > options.maxAgeMs) {
					continue;
				}
			}

			// Calculate relevance score
			let score = 0;
			const content = memory.content.toLowerCase();
			const key = memory.key.toLowerCase();

			// Exact word matches in content
			const words = queryLower.split(/\s+/);
			for (const word of words) {
				if (word && content.includes(word)) {
					score += 1;
				}
				if (word && key.includes(word)) {
					score += 2; // Higher weight for key matches
				}
			}

			// Boost score for recently accessed
			const recencyBoost = Math.max(0, 1 - (Date.now() - memory.lastAccessedTimestamp) / (7 * 24 * 60 * 60 * 1000));
			score *= (1 + recencyBoost);

			// Filter by minimum score
			if (options.minScore && score < options.minScore) {
				continue;
			}

			results.push({
				entry: memory,
				relevanceScore: score,
				score,
			});
		}

		// Sort by score descending
		results.sort((a, b) => b.score - a.score);

		// Apply limit
		const limit = options.limit ?? 10;
		return results.slice(0, limit).map(r => ({
			entry: r.entry,
			relevanceScore: r.relevanceScore,
		}));
	}

	getMemoriesByType(type: MemoryStorageType, limit?: number): IMemoryEntry[] {
		const results: IMemoryEntry[] = [];

		for (const id of this.memoryOrder) {
			const memory = this.memories[id];
			if (memory.type === type) {
				results.push(memory);
				if (limit && results.length >= limit) {
					break;
				}
			}
		}

		return results;
	}

	getMemoriesByKey(key: string): IMemoryEntry[] {
		const results: IMemoryEntry[] = [];

		for (const memory of Object.values(this.memories)) {
			if (memory.key === key) {
				results.push(memory);
			}
		}

		return results;
	}

	getRecentMemories(limit: number): IMemoryEntry[] {
		const results: IMemoryEntry[] = [];

		// Start from most recent
		for (let i = this.memoryOrder.length - 1; i >= 0 && results.length < limit; i--) {
			const memory = this.memories[this.memoryOrder[i]];
			if (memory) {
				results.push(memory);
			}
		}

		return results;
	}

	getMemoriesByTags(tags: string[]): IMemoryEntry[] {
		const results: IMemoryEntry[] = [];

		for (const memory of Object.values(this.memories)) {
			if (tags.some(t => memory.tags.includes(t))) {
				results.push(memory);
			}
		}

		return results;
	}

	// ── Memory Access ─────────────────────────────────────────────────────────

	accessMemory(memoryId: string): IMemoryEntry | undefined {
		const memory = this.memories[memoryId];
		if (!memory) {
			return undefined;
		}

		// Update access metadata
		const updated = {
			...memory,
			lastAccessedTimestamp: Date.now(),
			accessCount: memory.accessCount + 1,
		};

		this.memories[memoryId] = updated;

		// Move to end of order (most recent)
		const orderIndex = this.memoryOrder.indexOf(memoryId);
		if (orderIndex !== -1) {
			this.memoryOrder.splice(orderIndex, 1);
			this.memoryOrder.push(memoryId);
		}

		return updated;
	}

	// ── Memory Compression ────────────────────────────────────────────────────

	compressMemories(maxAgeMs: number, keepCount: number): number {
		const cutoffTime = Date.now() - maxAgeMs;
		let compressed = 0;

		for (const [id, memory] of Object.entries(this.memories)) {
			if (memory.timestamp < cutoffTime) {
				// Simple compression: summarize content
				const summary = this.summarizeContent(memory.content);
				if (summary.length < memory.content.length) {
					this.memories[id] = {
						...memory,
						content: summary,
						metadata: {
							...memory.metadata,
							compressed: true,
							originalLength: memory.content.length,
						},
					};
					compressed++;
				}
			}
		}

		// Also enforce memory count limit
		const excessCount = this.memoryOrder.length - this.MAX_MEMORIES;
		if (excessCount > 0) {
			const removed = this.memoryOrder.slice(0, excessCount);
			for (const id of removed) {
				delete this.memories[id];
			}
			this.memoryOrder.splice(0, excessCount);
			compressed += excessCount;
		}

		if (compressed > 0) {
			this.logService.info(`Compressed ${compressed} memories`);
		}

		return compressed;
	}

	// ── Memory Expiration ─────────────────────────────────────────────────────

	expireMemories(maxAgeMs: number): number {
		const cutoffTime = Date.now() - maxAgeMs;
		const toDelete: string[] = [];

		for (const [id, memory] of Object.entries(this.memories)) {
			// Don't expire knowledge memories
			if (memory.type === 'knowledge') {
				continue;
			}

			if (memory.timestamp < cutoffTime) {
				toDelete.push(id);
			}
		}

		for (const id of toDelete) {
			delete this.memories[id];
			const orderIndex = this.memoryOrder.indexOf(id);
			if (orderIndex !== -1) {
				this.memoryOrder.splice(orderIndex, 1);
			}
		}

		if (toDelete.length > 0) {
			this.logService.info(`Expired ${toDelete.length} memories`);
		}

		return toDelete.length;
	}

	// ── Statistics ───────────────────────────────────────────────────────────

	getStats(): IMemoryStats {
		const byType: Record<MemoryStorageType, number> = {
			conversation: 0,
			agent: 0,
			workspace: 0,
			project: 0,
			knowledge: 0,
			session: 0,
		};

		let totalTokens = 0;
		let oldestEntry = Infinity;
		let newestEntry = 0;

		for (const memory of Object.values(this.memories)) {
			byType[memory.type]++;
			totalTokens += Math.ceil(memory.content.length / 4);
			oldestEntry = Math.min(oldestEntry, memory.timestamp);
			newestEntry = Math.max(newestEntry, memory.timestamp);
		}

		return {
			totalEntries: this.memoryOrder.length,
			byType,
			totalTokens,
			oldestEntry: oldestEntry === Infinity ? 0 : oldestEntry,
			newestEntry,
		};
	}

	// ── Persistence ───────────────────────────────────────────────────────────

	async persist(): Promise<void> {
		// Prepare storage data
		const storageData = {
			memories: this.memories,
			order: this.memoryOrder,
		};

		// In a real implementation, this would save to persistent storage
		// For now, just log the intent
		this.logService.info(`Persisting ${this.memoryOrder.length} memories to storage`);

		// Update runtime state
		const stats = this.getStats();
		this.runtimeStateService.updateProviders({
			memoryUpdates: {
				stats,
			},
		});
	}

	async load(): Promise<void> {
		// In a real implementation, this would load from persistent storage
		this.logService.info('Loading memories from storage');

		// For now, memories start empty
		this.memories = {};
		this.memoryOrder = [];
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private summarizeContent(content: string): string {
		// Simple summarization: take first and last sentences
		const sentences = content.split(/[.!?]+/).filter(s => s.trim());
		if (sentences.length <= 2) {
			return content;
		}

		return `${sentences[0].trim()}. ... ${sentences[sentences.length - 1].trim()}.`;
	}
}
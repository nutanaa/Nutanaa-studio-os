/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import {
	MemoryStorageType,
	IMemoryEntry,
	IMemorySearchOptions,
	IMemorySearchResult,
	IMemoryStats,
} from '../models/aiCore.js';

/**
 * Service for managing memories in Nutanaa Studio OS.
 *
 * Responsibilities:
 * - Memory storage for all types (conversation, agent, workspace, project, knowledge, session)
 * - Memory search and retrieval
 * - Memory compression
 * - Memory expiration
 */
export const IMemoryManager = createDecorator<IMemoryManager>('nutanaaMemoryManager');

export interface IMemoryManager {

	// ── Memory CRUD ────────────────────────────────────────────────────────────

	/**
	 * Create a new memory entry.
	 * @param entry The memory entry to create
	 * @returns Created memory ID
	 */
	createMemory(entry: Omit<IMemoryEntry, 'id' | 'timestamp' | 'lastAccessedTimestamp' | 'accessCount'>): string;

	/**
	 * Get a memory entry by ID.
	 * @param memoryId The memory ID
	 * @returns Memory entry or undefined
	 */
	getMemory(memoryId: string): IMemoryEntry | undefined;

	/**
	 * Update a memory entry.
	 * @param memoryId The memory ID
	 * @param updates Partial updates
	 * @returns True if update succeeded
	 */
	updateMemory(memoryId: string, updates: Partial<IMemoryEntry>): boolean;

	/**
	 * Delete a memory entry.
	 * @param memoryId The memory ID
	 * @returns True if deletion succeeded
	 */
	deleteMemory(memoryId: string): boolean;

	/**
	 * Delete all memories of a type.
	 * @param type The memory type
	 * @returns Number of deleted memories
	 */
	deleteMemoriesByType(type: MemoryStorageType): number;

	/**
	 * Delete all memories by tag.
	 * @param tag The tag to match
	 * @returns Number of deleted memories
	 */
	deleteMemoriesByTag(tag: string): number;

	// ── Memory Search ─────────────────────────────────────────────────────────

	/**
	 * Search memories by query.
	 * @param query The search query
	 * @param options Search options
	 * @returns Array of search results
	 */
	searchMemories(query: string, options: IMemorySearchOptions): Promise<IMemorySearchResult[]>;

	/**
	 * Get memories by type.
	 * @param type The memory type
	 * @param limit Maximum results
	 * @returns Array of memory entries
	 */
	getMemoriesByType(type: MemoryStorageType, limit?: number): IMemoryEntry[];

	/**
	 * Get memories by key.
	 * @param key The memory key
	 * @returns Array of memory entries
	 */
	getMemoriesByKey(key: string): IMemoryEntry[];

	/**
	 * Get recent memories.
	 * @param limit Maximum results
	 * @returns Array of memory entries
	 */
	getRecentMemories(limit: number): IMemoryEntry[];

	/**
	 * Get memories by tags.
	 * @param tags Array of tags
	 * @returns Array of memory entries
	 */
	getMemoriesByTags(tags: string[]): IMemoryEntry[];

	// ── Memory Access ─────────────────────────────────────────────────────────

	/**
	 * Access a memory (updates access timestamp and count).
	 * @param memoryId The memory ID
	 * @returns Memory entry or undefined
	 */
	accessMemory(memoryId: string): IMemoryEntry | undefined;

	// ── Memory Compression ────────────────────────────────────────────────────

	/**
	 * Compress old memories.
	 * @param maxAgeMs Maximum age in milliseconds
	 * @param keepCount Number of recent memories to keep
	 * @returns Number of compressed memories
	 */
	compressMemories(maxAgeMs: number, keepCount: number): number;

	// ── Memory Expiration ─────────────────────────────────────────────────────

	/**
	 * Delete expired memories.
	 * @param maxAgeMs Maximum age in milliseconds
	 * @returns Number of deleted memories
	 */
	expireMemories(maxAgeMs: number): number;

	// ── Statistics ───────────────────────────────────────────────────────────

	/**
	 * Get memory statistics.
	 * @returns Memory statistics
	 */
	getStats(): IMemoryStats;

	// ── Persistence ───────────────────────────────────────────────────────────

	/**
	 * Persist memories to storage.
	 */
	persist(): Promise<void>;

	/**
	 * Load memories from storage.
	 */
	load(): Promise<void>;

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when memory is created, updated, or deleted.
	 */
	onDidChangeMemory: (listener: (memoryId: string, operation: 'create' | 'update' | 'delete') => void) => { dispose(): void };
}
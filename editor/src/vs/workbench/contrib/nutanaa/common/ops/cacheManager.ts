/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../../base/common/event.js';
import { ICacheConfig, ICacheStats, ICaches } from '../../models/productionModel.js';

/**
 * Service for caching in Nutanaa Studio OS Production.
 *
 * Responsibilities:
 * - Memory cache management
 * - Disk cache management
 * - Embedding cache for AI
 * - Prompt cache for AI
 * - Tool cache for AI
 * - HTTP cache for network requests
 * - Provider cache for API responses
 * - Eviction policies (LRU, FIFO, LFU)
 * - TTL support
 */
export const ICacheManager = createDecorator<ICacheManager>('nutanaaCacheManager');

export interface ICacheManager {

	// ── Memory Cache ─────────────────────────────────────────────────────────

	/**
	 * Get from memory cache.
	 * @param key Cache key
	 * @returns Cached value or undefined
	 */
	get<T = unknown>(key: string): T | undefined;

	/**
	 * Set in memory cache.
	 * @param key Cache key
	 * @param value Value to cache
	 * @param ttl Time to live in milliseconds
	 */
	set<T>(key: string, value: T, ttl?: number): void;

	/**
	 * Delete from memory cache.
	 * @param key Cache key
	 * @returns True if deleted
	 */
	delete(key: string): boolean;

	/**
	 * Clear memory cache.
	 */
	clearMemory(): void;

	// ── Disk Cache ───────────────────────────────────────────────────────────

	/**
	 * Get from disk cache.
	 * @param key Cache key
	 * @returns Cached value or undefined
	 */
	getFromDisk<T = unknown>(key: string): Promise<T | undefined>;

	/**
	 * Set in disk cache.
	 * @param key Cache key
	 * @param value Value to cache
	 * @param ttl Time to live in milliseconds
	 */
	setOnDisk<T>(key: string, value: T, ttl?: number): Promise<void>;

	/**
	 * Delete from disk cache.
	 * @param key Cache key
	 * @returns True if deleted
	 */
	deleteFromDisk(key: string): Promise<boolean>;

	/**
	 * Clear disk cache.
	 * @param olderThan Clear entries older than this
	 * @returns Number of entries cleared
	 */
	clearDisk(olderThan?: number): Promise<number>;

	// ── Specialized Caches ───────────────────────────────────────────────────

	/**
	 * Get embedding cache.
	 * @param key Embedding key (usually hash of input)
	 * @returns Cached embedding or undefined
	 */
	getEmbedding(key: string): Promise<number[] | undefined>;

	/**
	 * Set embedding cache.
	 * @param key Embedding key
	 * @param embedding Embedding vector
	 */
	setEmbedding(key: string, embedding: number[]): Promise<void>;

	/**
	 * Get prompt cache.
	 * @param key Prompt key (usually template name + variables)
	 * @returns Cached prompt or undefined
	 */
	getPrompt(key: string): Promise<string | undefined>;

	/**
	 * Set prompt cache.
	 * @param key Prompt key
	 * @param prompt Prompt template
	 */
	setPrompt(key: string, prompt: string): Promise<void>;

	/**
	 * Get tool cache.
	 * @param key Tool key
	 * @returns Cached result or undefined
	 */
	getTool<T = unknown>(key: string): Promise<T | undefined>;

	/**
	 * Set tool cache.
	 * @param key Tool key
	 * @param result Tool result
	 */
	setTool<T>(key: string, result: T): Promise<void>;

	/**
	 * Get HTTP cache.
	 * @param url URL to cache
	 * @returns Cached response or undefined
	 */
	getHttp<T = unknown>(url: string): Promise<T | undefined>;

	/**
	 * Set HTTP cache.
	 * @param url URL
	 * @param response Response to cache
	 * @param ttl TTL in milliseconds
	 */
	setHttp<T>(url: string, response: T, ttl?: number): Promise<void>;

	/**
	 * Get provider cache.
	 * @param key Cache key
	 * @returns Cached response or undefined
	 */
	getProvider<T = unknown>(key: string): Promise<T | undefined>;

	/**
	 * Set provider cache.
	 * @param key Cache key
	 * @param response Response to cache
	 * @param ttl TTL in milliseconds
	 */
	setProvider<T>(key: string, response: T, ttl?: number): Promise<void>;

	// ── Statistics ───────────────────────────────────────────────────────────

	/**
	 * Get cache statistics for all cache types.
	 * @returns Statistics
	 */
	getStats(): ICaches;

	/**
	 * Get memory cache stats.
	 * @returns Stats
	 */
	getMemoryStats(): ICacheStats;

	/**
	 * Get disk cache stats.
	 * @returns Stats
	 */
	getDiskStats(): Promise<ICacheStats>;

	// ── Management ───────────────────────────────────────────────────────────

	/**
	 * Configure a cache.
	 * @param cacheType Cache type
	 * @param config Configuration
	 */
	configure(cacheType: 'memory' | 'disk' | 'embedding' | 'prompt' | 'tool' | 'http' | 'provider', config: Partial<ICacheConfig>): void;

	/**
	 * Invalidate all caches.
	 * @param reason Reason for invalidation
	 * @returns Total entries cleared
	 */
	invalidateAll(reason: 'manual' | 'memory' | 'disk' | 'update'): Promise<number>;

	/**
	 * Run eviction.
	 * @param cacheType Cache type
	 * @returns Number of entries evicted
	 */
	evict(cacheType: string): Promise<number>;

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when cache is cleared.
	 */
	onDidClearCache: Event<{ cacheType: string; entries: number }>;
}
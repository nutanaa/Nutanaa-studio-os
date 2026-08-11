/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { ICacheConfig, ICacheEntry, ICacheStats, ICaches } from '../../models/productionModel.js';
import { ICacheManager } from '../../common/ops/cacheManager.js';
import { IRuntimeEventBus } from '../../common/runtime/runtimeEventBus.js';
import { RuntimeEventType } from '../../common/runtime/runtimeEvents.js';
import { IRuntimeStateService, IRuntimeState } from '../../common/runtime/runtimeState.js';

/**
 * CacheManager implementation for Nutanaa Studio OS Production.
 *
 * Provides multi-tier caching with LRU/FIFO/LFU eviction and TTL.
 */
export class CacheManager extends Disposable implements ICacheManager {

	declare readonly _serviceBrand: undefined;

	private memoryCache = new Map<string, ICacheEntry>();
	private embeddingCache = new Map<string, { embedding: number[]; expiresAt: number }>();
	private promptCache = new Map<string, { prompt: string; expiresAt: number }>();
	private toolCache = new Map<string, { result: unknown; expiresAt: number }>();
	private diskCache = new Map<string, { data: unknown; expiresAt: number; size: number }>();
	private httpCache = new Map<string, { data: unknown; expiresAt: number; etag?: string }>();
	private providerCache = new Map<string, { data: unknown; expiresAt: number }>();

	private configs = new Map<string, Partial<ICacheConfig>>([
		['memory', { maxSize: 100 * 1024 * 1024, ttl: 3600000, eviction: 'lru', enabled: true }],
		['disk', { maxSize: 500 * 1024 * 1024, ttl: 86400000, eviction: 'lru', enabled: true }],
		['embedding', { maxSize: 200 * 1024 * 1024, ttl: 604800000, eviction: 'lru', enabled: true }],
		['prompt', { maxSize: 10 * 1024 * 1024, ttl: 3600000, eviction: 'lru', enabled: true }],
		['tool', { maxSize: 50 * 1024 * 1024, ttl: 1800000, eviction: 'lru', enabled: true }],
		['http', { maxSize: 100 * 1024 * 1024, ttl: 300000, eviction: 'lru', enabled: true }],
		['provider', { maxSize: 50 * 1024 * 1024, ttl: 60000, eviction: 'lru', enabled: true }],
	]);

	private readonly _onDidClearCache = this._register(new Emitter<{ cacheType: string; entries: number }>());
	public readonly onDidClearCache = this._onDidClearCache.event;

	private readonly MAX_MEMORY_ENTRIES = 10000;

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.loadDiskCache();
	}

	// ── Memory Cache ─────────────────────────────────────────────────────────

	get<T = unknown>(key: string): T | undefined {
		const entry = this.memoryCache.get(key);
		if (!entry) {
			return undefined;
		}

		if (entry.expiresAt && Date.now() > entry.expiresAt) {
			this.memoryCache.delete(key);
			return undefined;
		}

		// Update access time for LRU
		const updatedEntry: ICacheEntry<T> = {
			...entry,
			accessedAt: Date.now(),
		} as ICacheEntry<T>;
		this.memoryCache.set(key, updatedEntry);

		return entry.value as T;
	}

	set<T>(key: string, value: T, ttl?: number): void {
		const config = this.configs.get('memory')!;
		const expiresAt = ttl ? Date.now() + ttl : config.ttl ? Date.now() + config.ttl : 0;

		const entry: ICacheEntry<T> = {
			key,
			value,
			createdAt: Date.now(),
			accessedAt: Date.now(),
			expiresAt,
			hitCount: 0,
			size: this.estimateSize(value),
		};

		this.memoryCache.set(key, entry);

		// Check for eviction
		this.evictIfNeeded('memory');
	}

	delete(key: string): boolean {
		return this.memoryCache.delete(key);
	}

	clearMemory(): void {
		const count = this.memoryCache.size;
		this.memoryCache.clear();
		this.fireCacheCleared('memory', count);
	}

	// ── Disk Cache ───────────────────────────────────────────────────────────

	async getFromDisk<T = unknown>(key: string): Promise<T | undefined> {
		const entry = this.diskCache.get(key);
		if (!entry) {
			return undefined;
		}

		if (Date.now() > entry.expiresAt) {
			this.diskCache.delete(key);
			return undefined;
		}

		return entry.data as T;
	}

	async setOnDisk<T>(key: string, value: T, ttl?: number): Promise<void> {
		const config = this.configs.get('disk')!;
		const expiresAt = ttl ? Date.now() + ttl : config.ttl ? Date.now() + config.ttl : 0;

		const size = this.estimateSize(value);

		this.diskCache.set(key, {
			data: value,
			expiresAt,
			size,
		});

		await this.evictDiskIfNeeded();
		this.saveDiskCache();
	}

	async deleteFromDisk(key: string): Promise<boolean> {
		return this.diskCache.delete(key);
	}

	async clearDisk(olderThan?: number): Promise<number> {
		const threshold = olderThan || Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
		let count = 0;

		for (const [key, entry] of this.diskCache) {
			if (entry.expiresAt && entry.expiresAt < threshold) {
				this.diskCache.delete(key);
				count++;
			}
		}

		if (count > 0) {
			this.saveDiskCache();
			this.fireCacheCleared('disk', count);
		}

		return count;
	}

	// ── Specialized Caches ───────────────────────────────────────────────────

	async getEmbedding(key: string): Promise<number[] | undefined> {
		const entry = this.embeddingCache.get(key);
		if (!entry) {
			return undefined;
		}

		if (Date.now() > entry.expiresAt) {
			this.embeddingCache.delete(key);
			return undefined;
		}

		return entry.embedding;
	}

	async setEmbedding(key: string, embedding: number[]): Promise<void> {
		const config = this.configs.get('embedding')!;
		const expiresAt = config.ttl ? Date.now() + config.ttl : 0;

		this.embeddingCache.set(key, { embedding, expiresAt });
	}

	async getPrompt(key: string): Promise<string | undefined> {
		const entry = this.promptCache.get(key);
		if (!entry) {
			return undefined;
		}

		if (Date.now() > entry.expiresAt) {
			this.promptCache.delete(key);
			return undefined;
		}

		return entry.prompt;
	}

	async setPrompt(key: string, prompt: string): Promise<void> {
		const config = this.configs.get('prompt')!;
		const expiresAt = config.ttl ? Date.now() + config.ttl : 0;

		this.promptCache.set(key, { prompt, expiresAt });
	}

	async getTool<T = unknown>(key: string): Promise<T | undefined> {
		const entry = this.toolCache.get(key);
		if (!entry) {
			return undefined;
		}

		if (Date.now() > entry.expiresAt) {
			this.toolCache.delete(key);
			return undefined;
		}

		return entry.result as T;
	}

	async setTool<T>(key: string, result: T): Promise<void> {
		const config = this.configs.get('tool')!;
		const expiresAt = config.ttl ? Date.now() + config.ttl : 0;

		this.toolCache.set(key, { result, expiresAt });
	}

	async getHttp<T = unknown>(url: string): Promise<T | undefined> {
		const entry = this.httpCache.get(url);
		if (!entry) {
			return undefined;
		}

		if (Date.now() > entry.expiresAt) {
			this.httpCache.delete(url);
			return undefined;
		}

		return entry.data as T;
	}

	async setHttp<T>(url: string, response: T, ttl?: number): Promise<void> {
		const config = this.configs.get('http')!;
		const expiresAt = ttl ? Date.now() + ttl : config.ttl ? Date.now() + config.ttl : 0;

		this.httpCache.set(url, { data: response, expiresAt });
	}

	async getProvider<T = unknown>(key: string): Promise<T | undefined> {
		const entry = this.providerCache.get(key);
		if (!entry) {
			return undefined;
		}

		if (Date.now() > entry.expiresAt) {
			this.providerCache.delete(key);
			return undefined;
		}

		return entry.data as T;
	}

	async setProvider<T>(key: string, response: T, ttl?: number): Promise<void> {
		const config = this.configs.get('provider')!;
		const expiresAt = ttl ? Date.now() + ttl : config.ttl ? Date.now() + config.ttl : 0;

		this.providerCache.set(key, { data: response, expiresAt });
	}

	// ── Statistics ───────────────────────────────────────────────────────────

	getStats(): ICaches {
		return {
			memory: this.getMemoryStats(),
			disk: {
				hits: 0,
				misses: 0,
				evictions: 0,
				size: 0,
				count: this.diskCache.size,
				hitRate: 0,
			},
			embedding: {
				hits: 0,
				misses: 0,
				evictions: 0,
				size: 0,
				count: this.embeddingCache.size,
				hitRate: 0,
			},
			prompt: {
				hits: 0,
				misses: 0,
				evictions: 0,
				size: 0,
				count: this.promptCache.size,
				hitRate: 0,
			},
			tool: {
				hits: 0,
				misses: 0,
				evictions: 0,
				size: 0,
				count: this.toolCache.size,
				hitRate: 0,
			},
			http: {
				hits: 0,
				misses: 0,
				evictions: 0,
				size: 0,
				count: this.httpCache.size,
				hitRate: 0,
			},
			provider: {
				hits: 0,
				misses: 0,
				evictions: 0,
				size: 0,
				count: this.providerCache.size,
				hitRate: 0,
			},
		};
	}

	getMemoryStats(): ICacheStats {
		let size = 0;
		for (const entry of this.memoryCache.values()) {
			size += entry.size;
		}

		return {
			hits: 0,
			misses: 0,
			evictions: 0,
			size,
			count: this.memoryCache.size,
			hitRate: 0,
		};
	}

	async getDiskStats(): Promise<ICacheStats> {
		let size = 0;
		for (const entry of this.diskCache.values()) {
			size += entry.size;
		}

		return {
			hits: 0,
			misses: 0,
			evictions: 0,
			size,
			count: this.diskCache.size,
			hitRate: 0,
		};
	}

	// ── Management ───────────────────────────────────────────────────────────

	configure(cacheType: 'memory' | 'disk' | 'embedding' | 'prompt' | 'tool' | 'http' | 'provider', config: Partial<ICacheConfig>): void {
		const existing = this.configs.get(cacheType) || {};
		this.configs.set(cacheType, { ...existing, ...config });
		this.logService.info(`Cache ${cacheType} configured: ${JSON.stringify(config)}`);
	}

	async invalidateAll(reason: 'manual' | 'memory' | 'disk' | 'update'): Promise<number> {
		let total = 0;

		total += this.memoryCache.size;
		this.memoryCache.clear();

		total += this.embeddingCache.size;
		this.embeddingCache.clear();

		total += this.promptCache.size;
		this.promptCache.clear();

		total += this.toolCache.size;
		this.toolCache.clear();

		total += this.httpCache.size;
		this.httpCache.clear();

		total += this.providerCache.size;
		this.providerCache.clear();

		this.runtimeEventBus.fire({
			type: RuntimeEventType.CacheCleared,
			timestamp: Date.now(),
			payload: {
				cacheType: 'all',
				reason,
				freedSpace: 0,
			},
		});

		this.logService.info(`All caches invalidated (${total} entries)`);

		return total;
	}

	async evict(cacheType: string): Promise<number> {
		switch (cacheType) {
			case 'memory':
				return this.evictMemory();
			case 'disk':
				return this.evictDisk();
			default:
				return 0;
		}
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private evictIfNeeded(cacheType: string): void {
		const config = this.configs.get(cacheType)!;
		if (!config.maxSize) return;

		const maxEntries = cacheType === 'memory' ? this.MAX_MEMORY_ENTRIES : 1000;

		switch (cacheType) {
			case 'memory':
				if (this.memoryCache.size > maxEntries) {
					this.evictMemory();
				}
				break;
		}
	}

	private evictMemory(): number {
		let evicted = 0;
		const maxEntries = this.MAX_MEMORY_ENTRIES;

		if (this.memoryCache.size <= maxEntries) {
			return 0;
		}

		// LRU eviction
		const entries = Array.from(this.memoryCache.entries())
			.sort((a, b) => a[1].accessedAt - b[1].accessedAt);

		const toRemove = entries.slice(0, this.memoryCache.size - maxEntries);
		for (const [key] of toRemove) {
			this.memoryCache.delete(key);
			evicted++;
		}

		return evicted;
	}

	private async evictDiskIfNeeded(): Promise<void> {
		const config = this.configs.get('disk')!;
		if (!config.maxSize) return;

		let totalSize = 0;
		for (const entry of this.diskCache.values()) {
			totalSize += entry.size;
		}

		if (totalSize < config.maxSize) return;

		// LRU eviction
		const entries = Array.from(this.diskCache.entries())
			.sort((a, b) => a[1].expiresAt - b[1].expiresAt);

		for (const [key, entry] of entries) {
			this.diskCache.delete(key);
			totalSize -= entry.size;

			if (totalSize < config.maxSize! * 0.8) {
				break;
			}
		}
	}

	private async evictDisk(): Promise<number> {
		const config = this.configs.get('disk')!;
		const targetSize = config.maxSize! * 0.5;

		let totalSize = 0;
		for (const entry of this.diskCache.values()) {
			totalSize += entry.size;
		}

		if (totalSize <= targetSize) return 0;

		let evicted = 0;
		const entries = Array.from(this.diskCache.entries())
			.sort((a, b) => a[1].expiresAt - b[1].expiresAt);

		for (const [key, entry] of entries) {
			this.diskCache.delete(key);
			totalSize -= entry.size;
			evicted++;

			if (totalSize <= targetSize) break;
		}

		if (evicted > 0) {
			await this.saveDiskCache();
		}

		return evicted;
	}

	private estimateSize(value: unknown): number {
		try {
			return JSON.stringify(value).length * 2;
		} catch {
			return 100; // Default estimate
		}
	}

	private fireCacheCleared(cacheType: string, entries: number): void {
		this._onDidClearCache.fire({ cacheType, entries });

		this.runtimeEventBus.fire({
			type: RuntimeEventType.CacheCleared,
			timestamp: Date.now(),
			payload: {
				cacheType,
				reason: 'manual' as const,
				freedSpace: 0,
			},
		});
	}

	private loadDiskCache(): void {
		const stored = this.storageService.get('nutanaa.cache.disk', 0);
		if (stored) {
			try {
				const data = JSON.parse(stored);
				this.diskCache = new Map(Object.entries(data.entries || {}));
			} catch {
				this.diskCache = new Map();
			}
		}
	}

	private async saveDiskCache(): Promise<void> {
		const entries: Record<string, { data: unknown; expiresAt: number; size: number }> = {};
		for (const [key, entry] of this.diskCache) {
			entries[key] = entry;
		}

		this.storageService.store('nutanaa.cache.disk', JSON.stringify({
			entries,
			savedAt: Date.now(),
		}), StorageScope.APPLICATION, StorageTarget.MACHINE);

		this.updateProductionState();
	}

	private updateProductionState(): void {
		const stats = this.getStats();

		this.runtimeStateService.update({
			production: {
				cache: stats,
			},
		} as unknown as Partial<IRuntimeState>);
	}
}
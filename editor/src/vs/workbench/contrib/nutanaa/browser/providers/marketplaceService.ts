/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IPluginListing, IMarketplaceSearchResult, IInstallOptions } from '../../models/enterpriseModel.js';
import { IMarketplaceService } from '../../common/providers/marketplaceService.js';
import { IPluginManager } from '../../common/tools/pluginManager.js';
import { IRuntimeEventBus } from '../../common/runtime/runtimeEventBus.js';
import { RuntimeEventType } from '../../common/runtime/runtimeEvents.js';
import { IRuntimeStateService } from '../../common/runtime/runtimeState.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';

/**
 * MarketplaceService implementation for Nutanaa Studio OS Enterprise.
 *
 * Manages plugin discovery, installation, and updates from the marketplace.
 */
export class MarketplaceService extends Disposable implements IMarketplaceService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidInstallPlugin = this._register(new Emitter<{ pluginId: string }>());
	public readonly onDidInstallPlugin = this._onDidInstallPlugin.event;

	private readonly _onDidUpdatePlugin = this._register(new Emitter<{ pluginId: string; oldVersion: string; newVersion: string }>());
	public readonly onDidUpdatePlugin = this._onDidUpdatePlugin.event;

	private readonly _onDidRemovePlugin = this._register(new Emitter<{ pluginId: string }>());
	public readonly onDidRemovePlugin = this._onDidRemovePlugin.event;

	private cache = new Map<string, IPluginListing>();
	private cacheTimestamp = 0;
	private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

	private readonly MOCK_PLUGINS: IPluginListing[] = [
		{
			id: 'vscode.git',
			name: 'Git',
			displayName: 'Git Integration',
			description: 'Git integration for Visual Studio Code',
			author: 'Microsoft',
			version: '1.95.0',
			downloadCount: 50000000,
			rating: 4.8,
			categories: ['SCM Providers', 'Other'],
			tags: ['git', 'scm', 'version control'],
			iconUrl: 'https://assets.microsoft.com/vscode-git/icon.png',
			lastUpdated: Date.now(),
			publishedAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
		},
		{
			id: 'nutanaa.ai-complete',
			name: 'ai-complete',
			displayName: 'AI Code Completion',
			description: 'AI-powered code completion for Nutanaa Studio',
			author: 'Nutanaa',
			version: '1.2.0',
			downloadCount: 100000,
			rating: 4.5,
			categories: ['Machine Learning', 'Programming Languages'],
			tags: ['ai', 'completion', 'intellisense'],
			lastUpdated: Date.now() - 7 * 24 * 60 * 60 * 1000,
			publishedAt: Date.now() - 180 * 24 * 60 * 60 * 1000,
		},
		{
			id: 'nutanaa-theme-dracula',
			name: 'theme-dracula',
			displayName: 'Dracula Theme',
			description: 'Dark theme based on the Dracula color scheme',
			author: 'Dracula Theme',
			version: '3.0.0',
			downloadCount: 500000,
			rating: 4.7,
			categories: ['Themes'],
			tags: ['theme', 'dark', 'dracula'],
			lastUpdated: Date.now() - 14 * 24 * 60 * 60 * 1000,
			publishedAt: Date.now() - 730 * 24 * 60 * 60 * 1000,
		},
		{
			id: 'nutanaa-workflow-designer',
			name: 'workflow-designer',
			displayName: 'Workflow Designer',
			description: 'Visual workflow editor for creating AI agent workflows',
			author: 'Nutanaa',
			version: '1.0.0',
			downloadCount: 50000,
			rating: 4.6,
			categories: ['Visualization', 'Other'],
			tags: ['workflow', 'visual', 'designer'],
			lastUpdated: Date.now() - 3 * 24 * 60 * 60 * 1000,
			publishedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
		},
		{
			id: 'nutanaa-agent-monitor',
			name: 'agent-monitor',
			displayName: 'Agent Monitor',
			description: 'Monitor and manage running AI agents',
			author: 'Nutanaa',
			version: '1.1.0',
			downloadCount: 75000,
			rating: 4.4,
			categories: ['Other'],
			tags: ['monitoring', 'agents', 'debugging'],
			lastUpdated: Date.now() - 10 * 24 * 60 * 60 * 1000,
			publishedAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
		},
	];

	constructor(
		@IPluginManager private readonly pluginManager: IPluginManager,
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.initializeCache();
	}

	private initializeCache(): void {
		const stored = this.storageService.get('nutanaa.marketplace.cache', 0);
		if (stored) {
			try {
				const data = JSON.parse(stored);
				this.cache = new Map(Object.entries(data.listings || {}));
				this.cacheTimestamp = data.timestamp || 0;
			} catch {
				this.cache = new Map();
				this.cacheTimestamp = 0;
			}
		}

		// Initialize with mock plugins
		for (const plugin of this.MOCK_PLUGINS) {
			this.cache.set(plugin.id, plugin);
		}
	}

	// ── Browse ────────────────────────────────────────────────────────────────

	async getFeatured(): Promise<IPluginListing[]> {
		await this.ensureFreshCache();

		return Array.from(this.cache.values())
			.filter(p => p.downloadCount > 100000)
			.sort((a, b) => b.downloadCount - a.downloadCount)
			.slice(0, 10);
	}

	async getPopular(limit = 20): Promise<IPluginListing[]> {
		await this.ensureFreshCache();

		return Array.from(this.cache.values())
			.sort((a, b) => b.downloadCount - a.downloadCount)
			.slice(0, limit);
	}

	async getRecentlyUpdated(limit = 20): Promise<IPluginListing[]> {
		await this.ensureFreshCache();

		return Array.from(this.cache.values())
			.sort((a, b) => b.lastUpdated - a.lastUpdated)
			.slice(0, limit);
	}

	async getByCategory(category: string, limit = 50): Promise<IPluginListing[]> {
		await this.ensureFreshCache();

		return Array.from(this.cache.values())
			.filter(p => p.categories.includes(category))
			.slice(0, limit);
	}

	// ── Search ─────────────────────────────────────────────────────────────────

	async search(query: string): Promise<IMarketplaceSearchResult> {
		await this.ensureFreshCache();

		const normalizedQuery = query.toLowerCase();
		const results = Array.from(this.cache.values())
			.filter(p =>
				p.name.toLowerCase().includes(normalizedQuery) ||
				p.description.toLowerCase().includes(normalizedQuery) ||
				p.tags.some(t => t.toLowerCase().includes(normalizedQuery))
			)
			.sort((a, b) => b.downloadCount - a.downloadCount);

		return {
			count: results.length,
			listings: results,
		};
	}

	async searchWithFilters(
		query: string,
		options?: {
			category?: string;
			sortBy?: 'relevance' | 'rating' | 'downloads' | 'updated';
			offset?: number;
			limit?: number;
		}
	): Promise<IMarketplaceSearchResult> {
		let results = Array.from(this.cache.values());

		// Filter by query
		if (query) {
			const normalizedQuery = query.toLowerCase();
			results = results.filter(p =>
				p.name.toLowerCase().includes(normalizedQuery) ||
				p.description.toLowerCase().includes(normalizedQuery) ||
				p.tags.some(t => t.toLowerCase().includes(normalizedQuery))
			);
		}

		// Filter by category
		if (options?.category) {
			results = results.filter(p => p.categories.includes(options.category!));
		}

		// Sort
		switch (options?.sortBy) {
			case 'rating':
				results.sort((a, b) => b.rating - a.rating);
				break;
			case 'downloads':
				results.sort((a, b) => b.downloadCount - a.downloadCount);
				break;
			case 'updated':
				results.sort((a, b) => b.lastUpdated - a.lastUpdated);
				break;
			default:
				results.sort((a, b) => b.downloadCount - a.downloadCount);
		}

		const total = results.length;
		const offset = options?.offset || 0;
		const limit = options?.limit || 50;

		return {
			count: total,
			listings: results.slice(offset, offset + limit),
		};
	}

	// ── Get Details ───────────────────────────────────────────────────────────

	async getListing(pluginId: string): Promise<IPluginListing | undefined> {
		await this.ensureFreshCache();
		return this.cache.get(pluginId);
	}

	async getByPublisher(publisher: string): Promise<IPluginListing[]> {
		await this.ensureFreshCache();

		return Array.from(this.cache.values())
			.filter(p => p.author === publisher);
	}

	// ── Install/Update/Remove ─────────────────────────────────────────────────

	async install(pluginId: string, options?: IInstallOptions): Promise<void> {
		const listing = this.cache.get(pluginId);
		if (!listing) {
			throw new Error(`Plugin ${pluginId} not found in marketplace`);
		}

		// Verify signature
		const signatureValid = await this.verifySignature(pluginId);
		if (!signatureValid) {
			throw new Error('Plugin signature verification failed');
		}

		// Check dependencies
		const deps = await this.checkDependencies(pluginId);
		const missingDeps = deps.filter(d => !d.satisfied);
		if (missingDeps.length > 0 && !options?.skipDependencies) {
			// Would install dependencies here
			this.logService.warn(`Missing dependencies: ${missingDeps.map(d => d.name).join(', ')}`);
		}

		// Check compatibility
		const compatibility = await this.checkCompatibility(pluginId);
		if (!compatibility.compatible) {
			throw new Error(`Plugin not compatible: ${compatibility.issues.join(', ')}`);
		}

		// Install using plugin manager
		await this.pluginManager.installPlugin(listing.repository || `marketplace://${pluginId}`);

		// Fire events
		this._onDidInstallPlugin.fire({ pluginId });

		this.runtimeEventBus.fire({
			type: RuntimeEventType.PluginInstalled,
			timestamp: Date.now(),
			payload: {
				pluginId,
				version: listing.version,
				userId: 'current-user',
			},
		});

		this.logService.info(`Plugin ${listing.displayName} installed`);
	}

	async update(pluginId: string): Promise<void> {
		const plugin = this.pluginManager.getInstalledPlugins().get(pluginId);
		if (!plugin) {
			throw new Error(`Plugin ${pluginId} not installed`);
		}

		const listing = await this.getListing(pluginId);
		if (!listing) {
			throw new Error(`Plugin ${pluginId} not found in marketplace`);
		}

		const oldVersion = plugin.manifest.version;

		await this.pluginManager.updatePlugin(pluginId, listing.version);

		this._onDidUpdatePlugin.fire({
			pluginId,
			oldVersion,
			newVersion: listing.version,
		});

		this.logService.info(`Plugin ${pluginId} updated from ${oldVersion} to ${listing.version}`);
	}

	async remove(pluginId: string): Promise<void> {
		await this.pluginManager.uninstallPlugin(pluginId);

		this._onDidRemovePlugin.fire({ pluginId });

		this.runtimeEventBus.fire({
			type: RuntimeEventType.PluginRemoved,
			timestamp: Date.now(),
			payload: { pluginId },
		});

		this.logService.info(`Plugin ${pluginId} removed from marketplace`);
	}

	async checkForUpdates(): Promise<Array<{ pluginId: string; currentVersion: string; newVersion: string }>> {
		const updates: Array<{ pluginId: string; currentVersion: string; newVersion: string }> = [];

		for (const [pluginId, plugin] of this.pluginManager.getInstalledPlugins()) {
			const listing = this.cache.get(pluginId);
			if (listing && listing.version !== plugin.manifest.version) {
				updates.push({
					pluginId,
					currentVersion: plugin.manifest.version,
					newVersion: listing.version,
				});
			}
		}

		return updates;
	}

	// ── Verification ───────────────────────────────────────────────────────────

	async verifySignature(pluginId: string): Promise<boolean> {
		// Real implementation would verify cryptographic signatures
		return true;
	}

	async checkDependencies(pluginId: string): Promise<Array<{ name: string; satisfied: boolean; required: string }>> {
		const dependencies: Array<{ name: string; satisfied: boolean; required: string }> = [];
		const listing = this.cache.get(pluginId);

		if (!listing) {
			return dependencies;
		}

		// Mock dependency checking
		dependencies.push({
			name: 'nutanaa.core',
			satisfied: true,
			required: '>=1.0.0',
		});

		return dependencies;
	}

	async checkCompatibility(pluginId: string): Promise<{ compatible: boolean; issues: string[] }> {
		const issues: string[] = [];

		// Mock compatibility check
		// Real implementation would check VS Code version, etc.

		return {
			compatible: issues.length === 0,
			issues,
		};
	}

	// ── Ratings & Reviews ─────────────────────────────────────────────────────

	async getRating(pluginId: string): Promise<{ average: number; count: number }> {
		const listing = this.cache.get(pluginId);

		if (!listing) {
			return { average: 0, count: 0 };
		}

		return {
			average: listing.rating,
			count: Math.floor(listing.downloadCount / 1000),
		};
	}

	async submitReview(pluginId: string, rating: number, review: string): Promise<void> {
		// Real implementation would submit to marketplace API
		this.logService.info(`Review submitted for ${pluginId}: ${rating} stars`);
	}

	// ── Caching ───────────────────────────────────────────────────────────────

	async refreshCache(): Promise<void> {
		// Real implementation would fetch from marketplace API
		this.cacheTimestamp = Date.now();
		this.saveCache();
	}

	clearCache(): void {
		this.cache.clear();
		this.cacheTimestamp = 0;
	}

	getCachedListings(): IPluginListing[] {
		return Array.from(this.cache.values());
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private async ensureFreshCache(): Promise<void> {
		const now = Date.now();

		if (now - this.cacheTimestamp > this.CACHE_DURATION) {
			await this.refreshCache();
		}
	}

	private saveCache(): void {
		const data = {
			listings: Object.fromEntries(this.cache),
			timestamp: this.cacheTimestamp,
		};

		this.storageService.store('nutanaa.marketplace.cache', JSON.stringify(data), StorageScope.APPLICATION, StorageTarget.USER);

		this.updateMarketplaceState();
	}

	private updateMarketplaceState(): void {
		const marketplace: Array<{ id: string; name: string; displayName: string }> = [];

		for (const [id, listing] of this.cache) {
			marketplace.push({
				id,
				name: listing.name,
				displayName: listing.displayName,
			});
		}

		this.runtimeStateService.update({
			enterprisePlugins: {
				installed: this.pluginManager.getInstalledPlugins(),
				marketplace,
			},
		});
	}
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IPluginListing, IMarketplaceSearchResult, IInstallOptions } from '../../models/enterpriseModel.js';

/**
 * Service for managing the plugin marketplace in Nutanaa Studio OS Enterprise.
 *
 * Responsibilities:
 * - Browse and search plugins from the marketplace
 * - Install, update, and remove plugins
 * - Verify plugin signatures
 * - Dependency checks and compatibility validation
 * - Plugin ratings and reviews
 */
export const IMarketplaceService = createDecorator<IMarketplaceService>('nutanaaMarketplaceService');

export interface IMarketplaceService {

	// ── Browse ────────────────────────────────────────────────────────────────

	/**
	 * Get featured plugins.
	 * @returns Array of featured listings
	 */
	getFeatured(): Promise<IPluginListing[]>;

	/**
	 * Get popular plugins.
	 * @param limit Maximum number of results
	 * @returns Array of popular listings
	 */
	getPopular(limit?: number): Promise<IPluginListing[]>;

	/**
	 * Get recently updated plugins.
	 * @param limit Maximum number of results
	 * @returns Array of recent listings
	 */
	getRecentlyUpdated(limit?: number): Promise<IPluginListing[]>;

	/**
	 * Get plugins by category.
	 * @param category The category name
	 * @param limit Maximum number of results
	 * @returns Array of listings
	 */
	getByCategory(category: string, limit?: number): Promise<IPluginListing[]>;

	// ── Search ─────────────────────────────────────────────────────────────────

	/**
	 * Search the marketplace.
	 * @param query Search query
	 * @returns Search results
	 */
	search(query: string): Promise<IMarketplaceSearchResult>;

	/**
	 * Search with filters.
	 * @param query Search query
	 * @param options Search options
	 * @returns Search results
	 */
	searchWithFilters(
		query: string,
		options?: {
			category?: string;
			sortBy?: 'relevance' | 'rating' | 'downloads' | 'updated';
			offset?: number;
			limit?: number;
		}
	): Promise<IMarketplaceSearchResult>;

	// ── Get Details ───────────────────────────────────────────────────────────

	/**
	 * Get plugin listing by ID.
	 * @param pluginId The plugin ID
	 * @returns Plugin listing or undefined
	 */
	getListing(pluginId: string): Promise<IPluginListing | undefined>;

	/**
	 * Get all listings for a publisher.
	 * @param publisher Publisher name
	 * @returns Array of listings
	 */
	getByPublisher(publisher: string): Promise<IPluginListing[]>;

	// ── Install/Update/Remove ─────────────────────────────────────────────────

	/**
	 * Install a plugin from the marketplace.
	 * @param pluginId The plugin ID
	 * @param options Installation options
	 * @returns Installed plugin
	 */
	install(pluginId: string, options?: IInstallOptions): Promise<void>;

	/**
	 * Update a plugin to the latest version.
	 * @param pluginId The plugin ID
	 * @returns Updated plugin
	 */
	update(pluginId: string): Promise<void>;

	/**
	 * Remove a plugin.
	 * @param pluginId The plugin ID
	 */
	remove(pluginId: string): Promise<void>;

	/**
	 * Check for updates.
	 * @returns Array of plugins with updates
	 */
	checkForUpdates(): Promise<Array<{ pluginId: string; currentVersion: string; newVersion: string }>>;

	// ── Verification ───────────────────────────────────────────────────────────

	/**
	 * Verify plugin signature.
	 * @param pluginId The plugin ID
	 * @returns True if signature is valid
	 */
	verifySignature(pluginId: string): Promise<boolean>;

	/**
	 * Check dependencies for a plugin.
	 * @param pluginId The plugin ID
	 * @returns Array of dependencies with status
	 */
	checkDependencies(pluginId: string): Promise<Array<{ name: string; satisfied: boolean; required: string }>>;

	/**
	 * Validate compatibility.
	 * @param pluginId The plugin ID
	 * @returns Compatibility result
	 */
	checkCompatibility(pluginId: string): Promise<{ compatible: boolean; issues: string[] }>;

	// ── Ratings & Reviews ─────────────────────────────────────────────────────

	/**
	 * Get rating for a plugin.
	 * @param pluginId The plugin ID
	 * @returns Rating info
	 */
	getRating(pluginId: string): Promise<{ average: number; count: number }>;

	/**
	 * Submit a review.
	 * @param pluginId The plugin ID
	 * @param rating Rating (1-5)
	 * @param review Review text
	 */
	submitReview(pluginId: string, rating: number, review: string): Promise<void>;

	// ── Caching ───────────────────────────────────────────────────────────────

	/**
	 * Refresh marketplace cache.
	 */
	refreshCache(): Promise<void>;

	/**
	 * Clear marketplace cache.
	 */
	clearCache(): void;

	/**
	 * Get cached listings.
	 * @returns Cached listings
	 */
	getCachedListings(): IPluginListing[];
}
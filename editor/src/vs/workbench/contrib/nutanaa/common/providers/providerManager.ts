/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import {
	IProviderConfig,
	IProviderCapabilities,
	IProviderHealth,
	IProviderStatus,
	IProviderRequest,
	IProviderSelectionResult,
} from '../../models/aiCore.js';

/**
 * Service responsible for managing AI providers in Nutanaa Studio OS.
 *
 * Responsibilities:
 * - Provider registration and discovery
 * - Health monitoring
 * - Load balancing
 * - Retry and failover
 * - Timeout management
 * - Streaming support
 * - Cancellation
 */
export const IProviderManager = createDecorator<IProviderManager>('nutanaaProviderManager');

export interface IProviderManager {

	// ── Provider Registration ───────────────────────────────────────────────────

	/**
	 * Register a new AI provider.
	 * @param config The provider configuration
	 * @returns True if registration succeeded
	 */
	registerProvider(config: IProviderConfig): boolean;

	/**
	 * Remove a provider by name.
	 * @param providerName The name of the provider to remove
	 * @returns True if removal succeeded
	 */
	unregisterProvider(providerName: string): boolean;

	/**
	 * Update provider configuration.
	 * @param providerName The name of the provider
	 * @param updates Partial config updates
	 * @returns True if update succeeded
	 */
	updateProvider(providerName: string, updates: Partial<IProviderConfig>): boolean;

	// ── Provider Discovery ─────────────────────────────────────────────────────

	/**
	 * Get all registered providers.
	 * @returns Array of provider statuses
	 */
	getAllProviders(): IProviderStatus[];

	/**
	 * Get provider status by name.
	 * @param providerName The name of the provider
	 * @returns Provider status or undefined
	 */
	getProvider(providerName: string): IProviderStatus | undefined;

	/**
	 * Find providers matching request criteria.
	 * @param request The selection criteria
	 * @returns Array of matching providers
	 */
	findProviders(request: IProviderRequest): IProviderConfig[];

	/**
	 * Select the best provider based on request and load balancing.
	 * @param request The selection criteria
	 * @returns Selection result with provider and decision
	 */
	selectProvider(request: IProviderRequest): IProviderSelectionResult | undefined;

	// ── Health Monitoring ─────────────────────────────────────────────────────

	/**
	 * Get health status for all providers.
	 * @returns Array of health statuses
	 */
	getAllHealth(): IProviderHealth[];

	/**
	 * Get health status for a specific provider.
	 * @param providerName The name of the provider
	 * @returns Health status or undefined
	 */
	getHealth(providerName: string): IProviderHealth | undefined;

	/**
	 * Check and update health for all providers.
	 * @returns Map of provider names to health status
	 */
	refreshAllHealth(): Promise<Map<string, IProviderHealth>>;

	/**
	 * Check and update health for a specific provider.
	 * @param providerName The name of the provider
	 * @returns Updated health status
	 */
	refreshHealth(providerName: string): Promise<IProviderHealth | undefined>;

	// ── Provider Selection & Load Balancing ───────────────────────────────────

	/**
	 * Get the currently selected provider.
	 * @returns Selected provider config or undefined
	 */
	getSelectedProvider(): IProviderConfig | undefined;

	/**
	 * Set the selected provider.
	 * @param providerName The name of the provider to select
	 * @returns True if selection succeeded
	 */
	selectProviderByName(providerName: string): boolean;

	/**
	 * Get provider load for load balancing.
	 * @param providerName The name of the provider
	 * @returns Current load (0-1) or undefined
	 */
	getProviderLoad(providerName: string): number | undefined;

	/**
	 * Increment provider load (call when starting request).
	 * @param providerName The name of the provider
	 */
	incrementLoad(providerName: string): void;

	/**
	 * Decrement provider load (call when completing request).
	 * @param providerName The name of the provider
	 */
	decrementLoad(providerName: string): void;

	// ── Capabilities ───────────────────────────────────────────────────────────

	/**
	 * Get capabilities for a provider.
	 * @param providerName The name of the provider
	 * @returns Provider capabilities or undefined
	 */
	getCapabilities(providerName: string): IProviderCapabilities | undefined;

	/**
	 * Check if a provider supports a capability.
	 * @param providerName The name of the provider
	 * @param capability The capability to check
	 * @returns True if supported
	 */
	supportsCapability(providerName: string, capability: keyof IProviderCapabilities): boolean;

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when provider health changes.
	 */
	onDidChangeHealth: (listener: (health: IProviderHealth) => void) => { dispose(): void };

	/**
	 * Event fired when provider selection changes.
	 */
	onDidChangeSelection: (listener: (providerName: string) => void) => { dispose(): void };

	/**
	 * Event fired when provider is registered or unregistered.
	 */
	onDidChangeProviders: (listener: () => void) => { dispose(): void };
}
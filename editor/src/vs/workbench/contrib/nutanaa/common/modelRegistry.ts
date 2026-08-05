/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import {
	ProviderType,
	IModelInfo,
	IModelFilter,
	IProviderCapabilities,
} from '../models/aiCore.js';

/**
 * Service for managing AI models in Nutanaa Studio OS.
 *
 * Responsibilities:
 * - Register and unregister models
 * - Get model information
 * - Filter models by capabilities
 * - Set and get default models
 */
export const IModelRegistry = createDecorator<IModelRegistry>('nutanaaModelRegistry');

export interface IModelRegistry {

	// ── Model Registration ─────────────────────────────────────────────────────

	/**
	 * Register a new model.
	 * @param model The model information
	 * @returns True if registration succeeded
	 */
	registerModel(model: IModelInfo): boolean;

	/**
	 * Unregister a model by ID.
	 * @param modelId The model ID
	 * @returns True if unregistration succeeded
	 */
	unregisterModel(modelId: string): boolean;

	/**
	 * Update model information.
	 * @param modelId The model ID
	 * @param updates Partial model updates
	 * @returns True if update succeeded
	 */
	updateModel(modelId: string, updates: Partial<IModelInfo>): boolean;

	// ── Model Discovery ───────────────────────────────────────────────────────

	/**
	 * Get all registered models.
	 * @returns Array of all models
	 */
	getAllModels(): IModelInfo[];

	/**
	 * Get model by ID.
	 * @param modelId The model ID
	 * @returns Model info or undefined
	 */
	getModel(modelId: string): IModelInfo | undefined;

	/**
	 * Get model by name.
	 * @param name The model name
	 * @returns Model info or undefined
	 */
	getModelByName(name: string): IModelInfo | undefined;

	/**
	 * Get models by provider.
	 * @param providerType The provider type
	 * @returns Array of models
	 */
	getModelsByProvider(providerType: ProviderType): IModelInfo[];

	/**
	 * Filter models by criteria.
	 * @param filter The filter criteria
	 * @returns Array of matching models
	 */
	filterModels(filter: IModelFilter): IModelInfo[];

	/**
	 * Find models that support specific capabilities.
	 * @param capabilities Required capabilities
	 * @returns Array of capable models
	 */
	findModelsByCapabilities(capabilities: Partial<IProviderCapabilities>): IModelInfo[];

	// ── Default Models ─────────────────────────────────────────────────────────

	/**
	 * Set the default model for a provider type.
	 * @param providerType The provider type
	 * @param modelId The model ID to set as default
	 * @returns True if setting succeeded
	 */
	setDefaultModel(providerType: ProviderType, modelId: string): boolean;

	/**
	 * Get the default model for a provider type.
	 * @param providerType The provider type
	 * @returns Default model info or undefined
	 */
	getDefaultModel(providerType: ProviderType): IModelInfo | undefined;

	/**
	 * Set the global default model.
	 * @param modelId The model ID to set as global default
	 * @returns True if setting succeeded
	 */
	setGlobalDefaultModel(modelId: string): boolean;

	/**
	 * Get the global default model.
	 * @returns Global default model info or undefined
	 */
	getGlobalDefaultModel(): IModelInfo | undefined;

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when models are registered or unregistered.
	 */
	onDidChangeModels: (listener: () => void) => { dispose(): void };

	/**
	 * Event fired when default model changes.
	 */
	onDidChangeDefaultModel: (listener: (providerType: ProviderType | 'global') => void) => { dispose(): void };
}
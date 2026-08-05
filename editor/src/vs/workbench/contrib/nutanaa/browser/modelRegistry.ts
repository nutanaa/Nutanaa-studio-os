/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import {
	ProviderType,
	IModelInfo,
	IModelFilter,
	IProviderCapabilities,
} from '../models/aiCore.js';
import { IModelRegistry } from '../common/modelRegistry.js';
import { IRuntimeEventBus, RuntimeEventType } from '../common/runtimeEventBus.js';
import { IRuntimeStateService } from '../common/runtimeState.js';

/**
 * ModelRegistry implementation for Nutanaa Studio OS.
 *
 * Manages AI models with registration, discovery, filtering,
 * and default model selection.
 */
export class ModelRegistry extends Disposable implements IModelRegistry {

	declare readonly _serviceBrand: undefined;

	private readonly models = new Map<string, IModelInfo>();
	private readonly modelsByProvider = new Map<ProviderType, Set<string>>();
	private readonly defaultModels = new Map<ProviderType, string>();
	private globalDefaultModelId: string | undefined;

	private readonly _onDidChangeModels = this._register(new Emitter<void>());
	private readonly _onDidChangeDefaultModel = this._register(new Emitter<ProviderType | 'global'>());

	public readonly onDidChangeModels = Event.fromEmitter(this._onDidChangeModels);
	public readonly onDidChangeDefaultModel = Event.fromEmitter(this._onDidChangeDefaultModel);

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	// ── Model Registration ─────────────────────────────────────────────────────

	registerModel(model: IModelInfo): boolean {
		if (this.models.has(model.id)) {
			this.logService.warn(`Model ${model.id} already registered`);
			return false;
		}

		this.models.set(model.id, model);

		// Track by provider
		const providerModels = this.modelsByProvider.get(model.provider) ?? new Set();
		providerModels.add(model.id);
		this.modelsByProvider.set(model.provider, providerModels);

		// Update runtime state
		this.runtimeStateService.updateProviders({
			addedModels: [model],
		});

		// Fire event
		this._onDidChangeModels.fire();

		this.logService.info(`Model ${model.name} (${model.id}) registered for ${model.provider}`);
		return true;
	}

	unregisterModel(modelId: string): boolean {
		const model = this.models.get(modelId);
		if (!model) {
			this.logService.warn(`Model ${modelId} not found for unregistration`);
			return false;
		}

		this.models.delete(modelId);

		// Remove from provider tracking
		const providerModels = this.modelsByProvider.get(model.provider);
		if (providerModels) {
			providerModels.delete(modelId);
			if (providerModels.size === 0) {
				this.modelsByProvider.delete(model.provider);
			}
		}

		// Clear default if this was the default
		if (this.defaultModels.get(model.provider) === modelId) {
			this.defaultModels.delete(model.provider);
		}
		if (this.globalDefaultModelId === modelId) {
			this.globalDefaultModelId = undefined;
		}

		// Update runtime state
		this.runtimeStateService.updateProviders({
			removedModels: [modelId],
		});

		// Fire event
		this._onDidChangeModels.fire();

		this.logService.info(`Model ${modelId} unregistered`);
		return true;
	}

	updateModel(modelId: string, updates: Partial<IModelInfo>): boolean {
		const model = this.models.get(modelId);
		if (!model) {
			this.logService.warn(`Model ${modelId} not found for update`);
			return false;
		}

		const newModel = { ...model, ...updates };
		this.models.set(modelId, newModel);

		// Update runtime state
		this.runtimeStateService.updateProviders({
			updatedModels: [newModel],
		});

		// Fire event
		this._onDidChangeModels.fire();

		this.logService.info(`Model ${modelId} updated`);
		return true;
	}

	// ── Model Discovery ───────────────────────────────────────────────────────

	getAllModels(): IModelInfo[] {
		return Array.from(this.models.values());
	}

	getModel(modelId: string): IModelInfo | undefined {
		return this.models.get(modelId);
	}

	getModelByName(name: string): IModelInfo | undefined {
		for (const model of this.models.values()) {
			if (model.name === name) {
				return model;
			}
		}
		return undefined;
	}

	getModelsByProvider(providerType: ProviderType): IModelInfo[] {
		const modelIds = this.modelsByProvider.get(providerType);
		if (!modelIds) {
			return [];
		}

		return Array.from(modelIds)
			.map(id => this.models.get(id))
			.filter((m): m is IModelInfo => m !== undefined);
	}

	filterModels(filter: IModelFilter): IModelInfo[] {
		const results: IModelInfo[] = [];

		for (const model of this.models.values()) {
			if (!model.available) {
				continue;
			}

			if (filter.providerType !== undefined && model.provider !== filter.providerType) {
				continue;
			}

			if (filter.minContextLength !== undefined &&
				model.contextLength < filter.minContextLength) {
				continue;
			}

			if (filter.supportsStreaming !== undefined &&
				model.capabilities.supportsStreaming !== filter.supportsStreaming) {
				continue;
			}

			if (filter.supportsFunctionCalling !== undefined &&
				model.capabilities.supportsFunctionCalling !== filter.supportsFunctionCalling) {
				continue;
			}

			if (filter.supportsVision !== undefined &&
				model.capabilities.supportsVision !== filter.supportsVision) {
				continue;
			}

			if (filter.maxPricePer1M !== undefined) {
				const pricePer1M = model.pricing.inputPer1M + model.pricing.outputPer1M;
				if (pricePer1M > filter.maxPricePer1M) {
					continue;
				}
			}

			results.push(model);
		}

		return results;
	}

	findModelsByCapabilities(capabilities: Partial<IProviderCapabilities>): IModelInfo[] {
		const filter: IModelFilter = {
			supportsStreaming: capabilities.supportsStreaming,
			supportsFunctionCalling: capabilities.supportsFunctionCalling,
			supportsVision: capabilities.supportsVision,
			minContextLength: capabilities.maxContextLength,
		};

		return this.filterModels(filter);
	}

	// ── Default Models ─────────────────────────────────────────────────────────

	setDefaultModel(providerType: ProviderType, modelId: string): boolean {
		const model = this.models.get(modelId);
		if (!model) {
			this.logService.warn(`Model ${modelId} not found for default`);
			return false;
		}

		if (model.provider !== providerType) {
			this.logService.warn(`Model ${modelId} is not for provider ${providerType}`);
			return false;
		}

		this.defaultModels.set(providerType, modelId);

		// Update runtime state
		this.runtimeStateService.updateProviders({
			defaultModelUpdates: [{ providerType, modelId }],
		});

		// Fire event
		this._onDidChangeDefaultModel.fire(providerType);

		this.logService.info(`Default model for ${providerType} set to ${modelId}`);
		return true;
	}

	getDefaultModel(providerType: ProviderType): IModelInfo | undefined {
		const modelId = this.defaultModels.get(providerType);
		return modelId ? this.models.get(modelId) : undefined;
	}

	setGlobalDefaultModel(modelId: string): boolean {
		const model = this.models.get(modelId);
		if (!model) {
			this.logService.warn(`Model ${modelId} not found for global default`);
			return false;
		}

		this.globalDefaultModelId = modelId;

		// Update runtime state
		this.runtimeStateService.updateProviders({
			globalDefaultModel: modelId,
		});

		// Fire event
		this._onDidChangeDefaultModel.fire('global');

		this.logService.info(`Global default model set to ${modelId}`);
		return true;
	}

	getGlobalDefaultModel(): IModelInfo | undefined {
		return this.globalDefaultModelId ? this.models.get(this.globalDefaultModelId) : undefined;
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	/**
	 * Get the best model for a given provider and requirements.
	 */
	getBestModel(
		providerType: ProviderType,
		requirements?: Partial<IProviderCapabilities>
	): IModelInfo | undefined {
		const models = this.getModelsByProvider(providerType);

		if (models.length === 0) {
			return undefined;
		}

		// Filter by requirements
		let filtered = models;
		if (requirements) {
			filtered = models.filter(model => {
				if (requirements.supportsStreaming !== undefined &&
					model.capabilities.supportsStreaming !== requirements.supportsStreaming) {
					return false;
				}
				if (requirements.supportsFunctionCalling !== undefined &&
					model.capabilities.supportsFunctionCalling !== requirements.supportsFunctionCalling) {
					return false;
				}
				if (requirements.supportsVision !== undefined &&
					model.capabilities.supportsVision !== requirements.supportsVision) {
					return false;
				}
				if (requirements.maxContextLength !== undefined &&
					model.contextLength < requirements.maxContextLength) {
					return false;
				}
				return true;
			});
		}

		if (filtered.length === 0) {
			return models[0]; // Return first available if none match
		}

		// Sort by context length (descending) then by price (ascending)
		filtered.sort((a, b) => {
			if (b.contextLength !== a.contextLength) {
				return b.contextLength - a.contextLength;
			}
			const aPrice = a.pricing.inputPer1M + a.pricing.outputPer1M;
			const bPrice = b.pricing.inputPer1M + b.pricing.outputPer1M;
			return aPrice - bPrice;
		});

		return filtered[0];
	}
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Promises } from '../../../../../base/common/async.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import {
	IProviderConfig,
	IProviderCapabilities,
	IProviderHealth,
	IProviderStatus,
	IProviderRequest,
	IProviderSelectionResult,
} from '../../models/aiCore.js';
import { IProviderManager  } from '../../common/providers/providerManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../../common/runtime/runtimeEventBus.js';
import { IRuntimeStateService } from '../../common/runtime/runtimeState.js';
import { INutanaaProviderSummary } from '../../common/nutanaa.js';

// Import paths for supported providers
import { RESTApiProvider } from './restApiProvider.js';
import { OpenAIProvider } from './openAiProvider.js';
import { AnthropicProvider } from './anthropicProvider.js';
import { OllamaProvider } from './ollamaProvider.js';
import { GeminiProvider } from './geminiProvider.js';
import { AzureOpenAIProvider } from './azureOpenAiProvider.js';
import { OpenRouterProvider } from './openRouterProvider.js';

interface ILLMProvider {
	readonly config: IProviderConfig;
	readonly provider: unknown;
	connect(): Promise<boolean>;
	disconnect(): Promise<void>;
	healthCheck(): Promise<IProviderHealth>;
	streamComplete(prompt: string, options: Record<string, unknown>): AsyncIterable<string>;
	complete(prompt: string, options: Record<string, unknown>): Promise<string>;
}

/**
 * ProviderManager implementation for Nutanaa Studio OS.
 *
 * Manages AI providers with health monitoring, load balancing, failover,
 * timeout management, streaming support, and cancellation.
 */
export class ProviderManager extends Disposable implements IProviderManager {

	declare readonly _serviceBrand: undefined;

	private readonly providers = new Map<string, IProviderStatus>();
	private readonly providerInstances = new Map<string, ILLMProvider>();
	private readonly loadCounts = new Map<string, number>();
	private readonly healthCheckTimers = new Map<string, ReturnType<typeof setInterval>>();

	private readonly _onDidChangeHealth = this._register(new Emitter<IProviderHealth>());
	private readonly _onDidChangeSelection = this._register(new Emitter<string>());
	private readonly _onDidChangeProviders = this._register(new Emitter<void>());

	public readonly onDidChangeHealth = this._onDidChangeHealth.event;
	public readonly onDidChangeSelection = this._onDidChangeSelection.event;
	public readonly onDidChangeProviders = this._onDidChangeProviders.event;

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this._register(Disposable.None); // Ensure proper disposal pattern
	}

	// ── Provider Registration ───────────────────────────────────────────────────

	registerProvider(config: IProviderConfig): boolean {
		if (this.providers.has(config.name)) {
			this.logService.warn(`Provider ${config.name} already registered`);
			return false;
		}

		const health: IProviderHealth = {
			providerName: config.name,
			isHealthy: false,
			lastChecked: 0,
			latencyMs: 0,
			errorCount: 0,
			modelAvailable: false,
		};

		const status: IProviderStatus = {
			config,
			health,
			isSelected: false,
			currentLoad: 0,
		};

		this.providers.set(config.name, status);
		this.loadCounts.set(config.name, 0);

		// Create provider instance
		const providerInstance = this.createProviderInstance(config);
		if (providerInstance) {
			this.providerInstances.set(config.name, providerInstance);
		}

		// Start health monitoring
		this.startHealthMonitoring(config.name);

		// Update runtime state
				// Fire event
		this.runtimeEventBus.fire({
			type: RuntimeEventType.ProviderRegistered,
			timestamp: Date.now(),
			payload: { name: config.name, status: 'registered', model: config.model },
		});

		this._onDidChangeProviders.fire();
		this.logService.info(`Provider ${config.name} (${config.type}) registered successfully`);
		return true;
	}

	unregisterProvider(providerName: string): boolean {
		const status = this.providers.get(providerName);
		if (!status) {
			this.logService.warn(`Provider ${providerName} not found for unregistration`);
			return false;
		}

		// Stop health monitoring
		this.stopHealthMonitoring(providerName);

		// Disconnect provider instance
		const instance = this.providerInstances.get(providerName);
		if (instance) {
			instance.disconnect().catch(err => {
				this.logService.error(`Error disconnecting provider ${providerName}: ${err}`);
			});
			this.providerInstances.delete(providerName);
		}

		// Remove from maps
		this.providers.delete(providerName);
		this.loadCounts.delete(providerName);

		// Update runtime state
				// Fire event
		this.runtimeEventBus.fire({
			type: RuntimeEventType.ProviderRemoved,
			timestamp: Date.now(),
			payload: { name: providerName, status: 'removed' },
		});

		this._onDidChangeProviders.fire();
		this.logService.info(`Provider ${providerName} unregistered`);
		return true;
	}

	updateProvider(providerName: string, updates: Partial<IProviderConfig>): boolean {
		const status = this.providers.get(providerName);
		if (!status) {
			this.logService.warn(`Provider ${providerName} not found for update`);
			return false;
		}

		const newConfig = { ...status.config, ...updates };
		const newStatus: IProviderStatus = {
			...status,
			config: newConfig,
		};

		this.providers.set(providerName, newStatus);

		// Recreate provider instance if needed
		if (updates.type || updates.baseUrl || updates.apiKey) {
			const instance = this.createProviderInstance(newConfig);
			if (instance) {
				this.providerInstances.set(providerName, instance);
			}
		}

		// Update runtime state
				// Fire event
		this.runtimeEventBus.fire({
			type: RuntimeEventType.ProviderChanged,
			timestamp: Date.now(),
			payload: {
				providerName,
				previousStatus: status.config.enabled ? 'enabled' : 'disabled',
				newStatus: newConfig.enabled ? 'enabled' : 'disabled',
				model: newConfig.model,
			},
		});

		this.logService.info(`Provider ${providerName} updated`);
		return true;
	}

	// ── Provider Discovery ─────────────────────────────────────────────────────

	getAllProviders(): IProviderStatus[] {
		return Array.from(this.providers.values());
	}

	getProvider(providerName: string): IProviderStatus | undefined {
		return this.providers.get(providerName);
	}

	findProviders(request: IProviderRequest): IProviderConfig[] {
		const results: IProviderConfig[] = [];

		for (const status of this.providers.values()) {
			if (!status.config.enabled) {
				continue;
			}

			if (request.providerType && status.config.type !== request.providerType) {
				continue;
			}

			if (request.capabilities) {
				const caps = status.config.capabilities;
				if (request.capabilities.supportsStreaming !== undefined &&
					caps.supportsStreaming !== request.capabilities.supportsStreaming) {
					continue;
				}
				if (request.capabilities.supportsFunctionCalling !== undefined &&
					caps.supportsFunctionCalling !== request.capabilities.supportsFunctionCalling) {
					continue;
				}
				if (request.capabilities.supportsVision !== undefined &&
					caps.supportsVision !== request.capabilities.supportsVision) {
					continue;
				}
				if (request.capabilities.maxContextLength !== undefined &&
					caps.maxContextLength < request.capabilities.maxContextLength) {
					continue;
				}
			}

			if (request.maxLatencyMs && status.health.latencyMs > request.maxLatencyMs) {
				continue;
			}

			results.push(status.config);
		}

		return results;
	}

	selectProvider(request: IProviderRequest): IProviderSelectionResult | undefined {
		const candidates = this.findProviders(request);

		if (candidates.length === 0) {
			return undefined;
		}

		// Apply load balancing
		candidates.sort((a, b) => {
			// First by priority (higher priority first)
			if (b.priority !== a.priority) {
				return b.priority - a.priority;
			}
			// Then by health status (healthy first)
			const aHealth = this.providers.get(a.name)?.health;
			const bHealth = this.providers.get(b.name)?.health;
			if (aHealth?.isHealthy !== bHealth?.isHealthy) {
				return aHealth?.isHealthy ? -1 : 1;
			}
			// Then by current load (lower load first)
			const aLoad = this.loadCounts.get(a.name) ?? 0;
			const bLoad = this.loadCounts.get(b.name) ?? 0;
			return aLoad - bLoad;
		});

		const selected = candidates[0];
		const load = this.loadCounts.get(selected.name) ?? 0;

		return {
			provider: selected,
			loadBalancingDecision: `Selected ${selected.name} (priority: ${selected.priority}, load: ${load}/${this.getProviderMaxConcurrency(selected)})`,
		};
	}

	// ── Health Monitoring ─────────────────────────────────────────────────────

	getAllHealth(): IProviderHealth[] {
		return Array.from(this.providers.values()).map(s => s.health);
	}

	getHealth(providerName: string): IProviderHealth | undefined {
		return this.providers.get(providerName)?.health;
	}

	async refreshAllHealth(): Promise<Map<string, IProviderHealth>> {
		const results = new Map<string, IProviderHealth>();

		await Promises.settled(
			Array.from(this.providers.keys()).map(async (name) => {
				const health = await this.refreshHealth(name);
				if (health) {
					results.set(name, health);
				}
			})
		);

		return results;
	}

	async refreshHealth(providerName: string): Promise<IProviderHealth | undefined> {
		const status = this.providers.get(providerName);
		if (!status) {
			return undefined;
		}

		const instance = this.providerInstances.get(providerName);
		if (!instance) {
			return status.health;
		}

		const startTime = Date.now();
		let health: IProviderHealth;

		try {
			health = await instance.healthCheck();
			health = {
				...health,
				latencyMs: Date.now() - startTime,
			};
		} catch (err) {
			health = {
				providerName,
				isHealthy: false,
				lastChecked: Date.now(),
				latencyMs: Date.now() - startTime,
				errorCount: status.health.errorCount + 1,
				modelAvailable: false,
			};
		}

		// Update status
		const newStatus: IProviderStatus = {
			...status,
			health,
		};
		this.providers.set(providerName, newStatus);

		// Update runtime state
		this.runtimeStateService.updateProviders({
			healthUpdates: [{ name: providerName, health }],
		});

		// Fire event if health changed
		if (health.isHealthy !== status.health.isHealthy) {
			this._onDidChangeHealth.fire(health);

			this.runtimeEventBus.fire({
				type: health.isHealthy ? RuntimeEventType.ProviderHealthy : RuntimeEventType.ProviderUnhealthy,
				timestamp: Date.now(),
				payload: { name: providerName, status: health.isHealthy ? 'healthy' : 'unhealthy' },
			});
		}

		return health;
	}

	// ── Provider Selection & Load Balancing ───────────────────────────────────

	getSelectedProvider(): IProviderConfig | undefined {
		for (const status of this.providers.values()) {
			if (status.isSelected) {
				return status.config;
			}
		}
		return undefined;
	}

	selectProviderByName(providerName: string): boolean {
		const status = this.providers.get(providerName);
		if (!status) {
			return false;
		}

		// Deselect all providers
		for (const [name, s] of this.providers) {
			this.providers.set(name, { ...s, isSelected: false });
		}

		// Select the specified provider
		this.providers.set(providerName, { ...status, isSelected: true });

		// Update runtime state
				// Fire event
		this._onDidChangeSelection.fire(providerName);

		this.runtimeEventBus.fire({
			type: RuntimeEventType.ProviderChanged,
			timestamp: Date.now(),
			payload: {
				providerName,
				previousStatus: 'not_selected',
				newStatus: 'selected',
				model: status.config.model,
			},
		});

		return true;
	}

	getProviderLoad(providerName: string): number | undefined {
		const count = this.loadCounts.get(providerName);
		const config = this.providers.get(providerName)?.config;
		const max = config ? this.getProviderMaxConcurrency(config) : 5;
		return count !== undefined && max > 0 ? count / max : undefined;
	}

	incrementLoad(providerName: string): void {
		const current = this.loadCounts.get(providerName) ?? 0;
		this.loadCounts.set(providerName, current + 1);

		const status = this.providers.get(providerName);
		if (status) {
			this.providers.set(providerName, { ...status, currentLoad: current + 1 });
		}
	}

	decrementLoad(providerName: string): void {
		const current = this.loadCounts.get(providerName) ?? 0;
		this.loadCounts.set(providerName, Math.max(0, current - 1));

		const status = this.providers.get(providerName);
		if (status) {
			this.providers.set(providerName, { ...status, currentLoad: Math.max(0, current - 1) });
		}
	}

	// ── Capabilities ───────────────────────────────────────────────────────────

	getCapabilities(providerName: string): IProviderCapabilities | undefined {
		return this.providers.get(providerName)?.config.capabilities;
	}

	supportsCapability(providerName: string, capability: keyof IProviderCapabilities): boolean {
		const caps = this.getCapabilities(providerName);
		return caps ? !!caps[capability] : false;
	}

	// ── Provider Factory ───────────────────────────────────────────────────────

	private createProviderInstance(config: IProviderConfig): ILLMProvider | undefined {
		switch (config.type) {
			case 'openai':
				return new OpenAIProvider(config);
			case 'anthropic':
				return new AnthropicProvider(config);
			case 'ollama':
				return new OllamaProvider(config);
			case 'gemini':
				return new GeminiProvider(config);
			case 'azure-openai':
				return new AzureOpenAIProvider(config);
			case 'openrouter':
				return new OpenRouterProvider(config);
			case 'custom-rest':
				return new RESTApiProvider(config);
			default:
				this.logService.error(`Unknown provider type: ${config.type}`);
				return undefined;
		}
	}

	private getProviderMaxConcurrency(config: IProviderConfig): number {
		// Default concurrency based on provider type
		switch (config.type) {
			case 'ollama':
				return 4;
			case 'openai':
			case 'anthropic':
			case 'gemini':
				return 10;
			case 'azure-openai':
				return 8;
			default:
				return 5;
		}
	}

	// ── Health Monitoring ─────────────────────────────────────────────────────

	private startHealthMonitoring(providerName: string): void {
		const status = this.providers.get(providerName);
		if (!status) {
			return;
		}

		// Immediate first check
		this.refreshHealth(providerName).catch(err => {
			this.logService.error(`Initial health check failed for ${providerName}: ${err}`);
		});

		// Periodic checks (every 30 seconds)
		const timer = setInterval(() => {
			this.refreshHealth(providerName).catch(err => {
				this.logService.error(`Health check failed for ${providerName}: ${err}`);
			});
		}, 30000);

		this.healthCheckTimers.set(providerName, timer);
	}

	private stopHealthMonitoring(providerName: string): void {
		const timer = this.healthCheckTimers.get(providerName);
		if (timer) {
			clearInterval(timer);
			this.healthCheckTimers.delete(providerName);
		}
	}

	// ── Stream Completion with Cancellation ───────────────────────────────────

	async *streamComplete(
		providerName: string,
		prompt: string,
		options: Record<string, unknown> = {}
	): AsyncIterable<string> {
		const instance = this.providerInstances.get(providerName);
		if (!instance) {
			throw new Error(`Provider ${providerName} not found`);
		}

		this.incrementLoad(providerName);
		try {
			yield* instance.streamComplete(prompt, options);
		} finally {
			this.decrementLoad(providerName);
		}
	}

	async complete(providerName: string, prompt: string, options: Record<string, unknown> = {}): Promise<string> {
		const instance = this.providerInstances.get(providerName);
		if (!instance) {
			throw new Error(`Provider ${providerName} not found`);
		}

		this.incrementLoad(providerName);
		try {
			return await instance.complete(prompt, options);
		} finally {
			this.decrementLoad(providerName);
		}
	}

	// ── Cleanup ─────────────────────────────────────────────────────────────────

	override dispose(): void {
		super.dispose();

		// Stop all health monitoring
		for (const [name] of this.healthCheckTimers) {
			this.stopHealthMonitoring(name);
		}

		// Disconnect all providers
		for (const [name, instance] of this.providerInstances) {
			instance.disconnect().catch(err => {
				this.logService.error(`Error disconnecting provider ${name}: ${err}`);
			});
		}

		this.providers.clear();
		this.providerInstances.clear();
		this.loadCounts.clear();
	}

	// ── Backend Sync ─────────────────────────────────────────────────────────────

	syncProviderStatuses(summaries: readonly INutanaaProviderSummary[]): void {
		const currentNames = new Set(this.providers.keys());
		const newNames = new Set(summaries.map(s => s.id));

		for (const name of currentNames) {
			if (!newNames.has(name)) {
				this.providers.delete(name);
				this.providerInstances.delete(name);
				this.loadCounts.delete(name);
				this.stopHealthMonitoring(name);
			}
		}

		for (const summary of summaries) {
			const existing = this.providers.get(summary.id);
			const health: IProviderHealth = {
				providerName: summary.id,
				isHealthy: summary.healthy,
				lastChecked: Date.now(),
				latencyMs: existing?.health.latencyMs ?? 0,
				errorCount: existing?.health.errorCount ?? 0,
				modelAvailable: summary.models.length > 0,
			};

			const config: IProviderConfig = {
				type: summary.type as IProviderConfig['type'],
				name: summary.id,
				baseUrl: '',
				model: summary.activeModel ?? summary.models[0] ?? '',
				capabilities: {
					supportsStreaming: false,
					supportsFunctionCalling: false,
					supportsVision: false,
					supportsAudio: false,
					supportsEmbedding: false,
					supportsReasoning: false,
					maxContextLength: 0,
					maxOutputTokens: 0,
					defaultTemperature: 0,
					supportedModalities: [],
				},
				timeoutMs: 0,
				maxRetries: 0,
				enabled: summary.status !== 'unhealthy',
				priority: 0,
			};

			const status: IProviderStatus = {
				config,
				health,
				isSelected: existing?.isSelected ?? false,
				currentLoad: existing?.currentLoad ?? 0,
			};

			this.providers.set(summary.id, status);
		}

		this._onDidChangeProviders.fire();
	}
}

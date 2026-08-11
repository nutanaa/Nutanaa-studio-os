/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	IProviderConfig,
	IProviderHealth,
} from '../../models/aiCore.js';

interface ILLMProvider {
	readonly config: IProviderConfig;
	connect(): Promise<boolean>;
	disconnect(): Promise<void>;
	healthCheck(): Promise<IProviderHealth>;
	streamComplete(prompt: string, options: Record<string, unknown>): AsyncIterable<string>;
	complete(prompt: string, options: Record<string, unknown>): Promise<string>;
}

export class OllamaProvider implements ILLMProvider {
	readonly config: IProviderConfig;
	readonly provider: unknown = this;
	private connected = false;

	constructor(config: IProviderConfig) {
		this.config = config;
	}

	async connect(): Promise<boolean> {
		if (this.connected) {
			return true;
		}

		try {
			const response = await fetch(`${this.config.baseUrl}/api/tags`, {
				method: 'GET',
			});

			this.connected = response.ok;
			return this.connected;
		} catch {
			this.connected = false;
			return false;
		}
	}

	async disconnect(): Promise<void> {
		this.connected = false;
	}

	async healthCheck(): Promise<IProviderHealth> {
		const startTime = Date.now();

		try {
			const response = await fetch(`${this.config.baseUrl}/api/tags`, {
				method: 'GET',
			});

			const latency = Date.now() - startTime;

			if (!response.ok) {
				return {
					providerName: this.config.name,
					isHealthy: false,
					lastChecked: Date.now(),
					latencyMs: latency,
					errorCount: 1,
					modelAvailable: false,
				};
			}

			// Check if model is available
			const data = await response.json() as { models?: Array<{ name: string }> };
			const modelName = this.config.model.includes(':') ? this.config.model : `${this.config.model}:latest`;
			const modelAvailable = data.models?.some(m => m.name === modelName || m.name.includes(this.config.model)) ?? false;

			return {
				providerName: this.config.name,
				isHealthy: true,
				lastChecked: Date.now(),
				latencyMs: latency,
				errorCount: 0,
				modelAvailable,
			};
		} catch (err) {
			return {
				providerName: this.config.name,
				isHealthy: false,
				lastChecked: Date.now(),
				latencyMs: Date.now() - startTime,
				errorCount: 1,
				modelAvailable: false,
			};
		}
	}

	async *streamComplete(prompt: string, options: Record<string, unknown> = {}): AsyncIterable<string> {
		const url = `${this.config.baseUrl}/api/generate`;

		const body = {
			model: this.config.model,
			prompt,
			stream: true,
			options: {
				temperature: options.temperature ?? this.config.capabilities.defaultTemperature,
				num_predict: options.maxTokens ?? this.config.capabilities.maxOutputTokens,
			},
		};

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Ollama API error: ${error}`);
		}

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('No response body');
		}

		const decoder = new TextDecoder();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value);

				try {
					const parsed = JSON.parse(chunk);
					if (parsed.response) {
						yield parsed.response;
					}
					if (parsed.done) {
						break;
					}
				} catch {
					// Ignore parsing errors
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	async complete(prompt: string, options: Record<string, unknown> = {}): Promise<string> {
		const url = `${this.config.baseUrl}/api/generate`;

		const body = {
			model: this.config.model,
			prompt,
			stream: false,
			options: {
				temperature: options.temperature ?? this.config.capabilities.defaultTemperature,
				num_predict: options.maxTokens ?? this.config.capabilities.maxOutputTokens,
			},
		};

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Ollama API error: ${error}`);
		}

		const data = await response.json() as { response?: string };
		return data.response ?? '';
	}
}



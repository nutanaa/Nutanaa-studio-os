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

export class OpenRouterProvider implements ILLMProvider {
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
			const response = await fetch(`${this.config.baseUrl}/models`, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${this.config.apiKey}`,
					'Content-Type': 'application/json',
				},
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
			const response = await fetch(`${this.config.baseUrl}/models`, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${this.config.apiKey}`,
					'Content-Type': 'application/json',
					'HTTP-Referer': 'https://nutanaa.studio',
				},
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

			const data = await response.json() as { data?: Array<{ id: string }> };
			const modelAvailable = data.data?.some(m => m.id === this.config.model) ?? false;

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
		const url = `${this.config.baseUrl}/chat/completions`;

		const body = {
			model: this.config.model,
			messages: [{ role: 'user', content: prompt }],
			stream: true,
			temperature: options.temperature ?? this.config.capabilities.defaultTemperature,
			max_tokens: options.maxTokens ?? this.config.capabilities.maxOutputTokens,
		};

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.config.apiKey}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://nutanaa.studio',
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenRouter API error: ${error}`);
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
				const lines = chunk.split('\n');

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.slice(6);
						if (data === '[DONE]') {
							return;
						}

						try {
							const parsed = JSON.parse(data);
							const content = parsed.choices?.[0]?.delta?.content;
							if (content) {
								yield content;
							}
						} catch {
							// Ignore parsing errors
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	async complete(prompt: string, options: Record<string, unknown> = {}): Promise<string> {
		const url = `${this.config.baseUrl}/chat/completions`;

		const body = {
			model: this.config.model,
			messages: [{ role: 'user', content: prompt }],
			stream: false,
			temperature: options.temperature ?? this.config.capabilities.defaultTemperature,
			max_tokens: options.maxTokens ?? this.config.capabilities.maxOutputTokens,
		};

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.config.apiKey}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://nutanaa.studio',
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenRouter API error: ${error}`);
		}

		const data = await response.json() as { choices?: Array<{ message: { content: string } }> };
		return data.choices?.[0]?.message?.content ?? '';
	}
}



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

export class AnthropicProvider implements ILLMProvider {
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
			const response = await fetch(`${this.config.baseUrl}/messages`, {
				method: 'HEAD',
				headers: {
					'Authorization': `Bearer ${this.config.apiKey ?? ''}`,
					'x-api-key': this.config.apiKey ?? '',
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
			const response = await fetch(`${this.config.baseUrl}/messages`, {
				method: 'HEAD',
				headers: {
					'Authorization': `Bearer ${this.config.apiKey ?? ''}`,
					'x-api-key': this.config.apiKey ?? '',
					'Content-Type': 'application/json',
					'anthropic-version': '2023-06-01',
				},
			});

			const latency = Date.now() - startTime;

			return {
				providerName: this.config.name,
				isHealthy: response.ok,
				lastChecked: Date.now(),
				latencyMs: latency,
				errorCount: response.ok ? 0 : 1,
				modelAvailable: response.ok,
			};
		} catch {
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
		const url = `${this.config.baseUrl}/messages`;

		const body = {
			model: this.config.model,
			max_tokens: options.maxTokens ?? this.config.capabilities.maxOutputTokens,
			temperature: options.temperature ?? this.config.capabilities.defaultTemperature,
			stream: true,
			messages: [{ role: 'user', content: prompt }],
		};

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.config.apiKey ?? ''}`,
				'x-api-key': this.config.apiKey ?? '',
				'Content-Type': 'application/json',
				'anthropic-version': '2023-06-01',
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Anthropic API error: ${error}`);
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

						try {
							const parsed = JSON.parse(data);
							const content = parsed.delta?.text || parsed.completion?.slice(-1)?.[0];
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
		const url = `${this.config.baseUrl}/messages`;

		const body = {
			model: this.config.model,
			max_tokens: options.maxTokens ?? this.config.capabilities.maxOutputTokens,
			temperature: options.temperature ?? this.config.capabilities.defaultTemperature,
			stream: false,
			messages: [{ role: 'user', content: prompt }],
		};

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.config.apiKey ?? ''}`,
				'x-api-key': this.config.apiKey ?? '',
				'Content-Type': 'application/json',
				'anthropic-version': '2023-06-01',
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Anthropic API error: ${error}`);
		}

		const data = await response.json() as { content?: Array<{ text: string }> };
		return data.content?.[0]?.text ?? '';
	}
}

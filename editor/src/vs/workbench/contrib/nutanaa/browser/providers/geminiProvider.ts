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

export class GeminiProvider implements ILLMProvider {
	readonly config: IProviderConfig;
	private connected = false;

	constructor(config: IProviderConfig) {
		this.config = config;
	}

	async connect(): Promise<boolean> {
		if (this.connected) {
			return true;
		}

		try {
			const url = `${this.config.baseUrl}/v1beta/models/${this.config.model}:get`;
			const response = await fetch(url, {
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
			const url = `${this.config.baseUrl}/v1beta/models/${this.config.model}:get`;
			const response = await fetch(url, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${this.config.apiKey}`,
					'Content-Type': 'application/json',
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

			return {
				providerName: this.config.name,
				isHealthy: true,
				lastChecked: Date.now(),
				latencyMs: latency,
				errorCount: 0,
				modelAvailable: true,
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
		const url = `${this.config.baseUrl}/v1beta/models/${this.config.model}:streamGenerateContent`;

		const body = {
			contents: [{ parts: [{ text: prompt }] }],
			generationConfig: {
				temperature: options.temperature ?? this.config.capabilities.defaultTemperature,
				maxOutputTokens: options.maxTokens ?? this.config.capabilities.maxOutputTokens,
			},
		};

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.config.apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Gemini API error: ${error}`);
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
					const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
					if (content) {
						yield content;
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
		const url = `${this.config.baseUrl}/v1beta/models/${this.config.model}:generateContent`;

		const body = {
			contents: [{ parts: [{ text: prompt }] }],
			generationConfig: {
				temperature: options.temperature ?? this.config.capabilities.defaultTemperature,
				maxOutputTokens: options.maxTokens ?? this.config.capabilities.maxOutputTokens,
			},
		};

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.config.apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Gemini API error: ${error}`);
		}

		const data = await response.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }> };
		return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
	}
}
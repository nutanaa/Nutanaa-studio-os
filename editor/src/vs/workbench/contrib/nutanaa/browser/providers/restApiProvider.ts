/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	IProviderConfig,
	IProviderHealth,
} from '../../models/aiCore.js';

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RESTApiProviderConfig extends IProviderConfig {
	apiPath?: string;
	authHeader?: string;
	authType?: 'bearer' | 'apikey' | 'basic' | 'none';
	requestMethod?: RequestMethod;
	responsePath?: string;
	errorPath?: string;
}

interface ILLMProvider {
	readonly config: IProviderConfig;
	connect(): Promise<boolean>;
	disconnect(): Promise<void>;
	healthCheck(): Promise<IProviderHealth>;
	streamComplete(prompt: string, options: Record<string, unknown>): AsyncIterable<string>;
	complete(prompt: string, options: Record<string, unknown>): Promise<string>;
}

export class RESTApiProvider implements ILLMProvider {
	readonly config: RESTApiProviderConfig;
	readonly provider: unknown = this;
	private connected = false;

	constructor(config: IProviderConfig) {
		this.config = config as RESTApiProviderConfig;
	}

	private getAuthHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};

		if (this.config.authType === 'bearer' && this.config.apiKey) {
			headers['Authorization'] = `Bearer ${this.config.apiKey}`;
		} else if (this.config.authType === 'apikey' && this.config.apiKey) {
			headers[this.config.authHeader || 'X-API-Key'] = this.config.apiKey;
		} else if (this.config.authType === 'basic' && this.config.apiKey) {
			headers['Authorization'] = `Basic ${this.config.apiKey}`;
		}

		return headers;
	}

	async connect(): Promise<boolean> {
		if (this.connected) {
			return true;
		}

		try {
			const health = await this.healthCheck();
			this.connected = health.isHealthy;
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
		const apiPath = this.config.apiPath || '/health';

		try {
			const response = await fetch(`${this.config.baseUrl}${apiPath}`, {
				method: this.config.requestMethod || 'GET',
				headers: this.getAuthHeaders(),
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
		const response = await this.makeRequest(prompt, true, options);

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

				// Try to extract content from response
				const content = this.extractContent(chunk, true);
				if (content) {
					yield content;
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	async complete(prompt: string, options: Record<string, unknown> = {}): Promise<string> {
		const response = await this.makeRequest(prompt, false, options);
		const text = await response.text();
		return this.extractContent(text, false) || text;
	}

	private async makeRequest(
		prompt: string,
		stream: boolean,
		options: Record<string, unknown>
	): Promise<Response> {
		const apiPath = this.config.apiPath || '/chat';
		const url = `${this.config.baseUrl}${apiPath}`;

		const body = JSON.stringify({
			model: this.config.model,
			messages: [{ role: 'user', content: prompt }],
			stream,
			...options,
		});

		const response = await fetch(url, {
			method: this.config.requestMethod || 'POST',
			headers: this.getAuthHeaders(),
			body,
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`REST API error: ${error}`);
		}

		return response;
	}

	private extractContent(text: string, isStreaming: boolean): string | null {
		if (!this.config.responsePath) {
			// Default to looking for common patterns
			if (isStreaming) {
				const match = text.match(/"content"\s*:\s*"([^"]*)"/);
				return match ? match[1] : null;
			} else {
				// Try to parse as JSON
				try {
					const parsed = JSON.parse(text);
					return parsed.choices?.[0]?.message?.content ||
						parsed.content ||
						parsed.text ||
						parsed.response ||
						null;
				} catch {
					return null;
				}
			}
		}

		// Use configured response path
		try {
			const parsed = JSON.parse(text);
			const pathParts = this.config.responsePath!.split('.');
			let result: unknown = parsed;

			for (const part of pathParts) {
				result = (result as Record<string, unknown>)?.[part];
				if (result === undefined) {
					return null;
				}
			}

			return typeof result === 'string' ? result : JSON.stringify(result);
		} catch {
			return null;
		}
	}
}


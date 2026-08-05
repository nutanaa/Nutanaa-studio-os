/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import {
	IEmbeddingResult,
	IBatchEmbeddingRequest,
	ISimilaritySearchResult,
	IEmbeddingOptions,
} from '../models/aiCore.js';
import { IEmbeddingManager } from '../common/embeddingManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../common/runtimeEventBus.js';
import { IRuntimeStateService } from '../common/runtimeState.js';

interface IndexedEmbedding {
	readonly result: IEmbeddingResult;
	readonly uri: string;
	readonly content: string;
}

/**
 * EmbeddingManager implementation for Nutanaa Studio OS.
 *
 * Manages text embeddings with batching, similarity search,
 * and chunk management.
 */
export class EmbeddingManager extends Disposable implements IEmbeddingManager {

	declare readonly _serviceBrand: undefined;

	private readonly index = new Map<string, IndexedEmbedding>();
	private readonly batchQueue: Array<{
		request: IBatchEmbeddingRequest;
		resolve: (results: IEmbeddingResult[]) => void;
		reject: (error: Error) => void;
	}> = [];
	private processingBatches = 0;
	private readonly maxConcurrentBatches = 3;

	private readonly _onDidCreateEmbedding = this._register(new Emitter<IEmbeddingResult>());

	public readonly onDidCreateEmbedding = Event.fromEmitter(this._onDidCreateEmbedding);

	private readonly DEFAULT_DIMENSIONS = 1536;
	private readonly DEFAULT_BATCH_SIZE = 32;

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	// ── Single Embeddings ──────────────────────────────────────────────────────

	async embed(text: string, options?: IEmbeddingOptions): Promise<IEmbeddingResult> {
		const model = options?.model || this.getDefaultModel();
		const dimensions = options?.dimensions || this.DEFAULT_DIMENSIONS;

		// Generate embedding (placeholder for actual embedding API)
		const vector = await this.generateEmbedding(text, dimensions);

		const result: IEmbeddingResult = {
			id: `emb-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			vector,
			dimensions,
			modelName: model,
			text,
			chunkId: `chunk-${Date.now()}`,
			timestamp: Date.now(),
		};

		// Fire event
		this._onDidCreateEmbedding.fire(result);
		this.runtimeEventBus.fire({
			type: RuntimeEventType.EmbeddingCreated,
			timestamp: Date.now(),
			payload: {
				embeddingId: result.id,
				chunkId: result.chunkId,
				dimensions: result.dimensions,
				modelName: result.modelName,
			},
		});

		return result;
	}

	// ── Batch Embeddings ───────────────────────────────────────────────────────

	async embedBatch(request: IBatchEmbeddingRequest): Promise<IEmbeddingResult[]> {
		const results: IEmbeddingResult[] = [];
		const batchSize = request.batchSize || this.DEFAULT_BATCH_SIZE;

		for (let i = 0; i < request.texts.length; i += batchSize) {
			const batch = request.texts.slice(i, i + batchSize);
			const chunkIds = request.chunkIds.slice(i, i + batchSize);

			const batchResults = await Promise.all(
				batch.map(async (text, idx) => {
					const result = await this.embed(text, {
						model: this.getDefaultModel(),
						dimensions: this.DEFAULT_DIMENSIONS,
					});

					// Update chunk ID to match request
					return {
						...result,
						chunkId: chunkIds[idx],
					};
				})
			);

			results.push(...batchResults);
		}

		// Index all results
		this.indexEmbeddings(results);

		return results;
	}

	async queueBatch(request: IBatchEmbeddingRequest): Promise<IEmbeddingResult[]> {
		return new Promise((resolve, reject) => {
			this.batchQueue.push({
				request,
				resolve,
				reject,
			});

			this.processBatchQueue();
		});
	}

	private async processBatchQueue(): Promise<void> {
		if (this.processingBatches >= this.maxConcurrentBatches) {
			return;
		}

		const next = this.batchQueue.shift();
		if (!next) {
			return;
		}

		this.processingBatches++;

		try {
			const results = await this.embedBatch(next.request);
			next.resolve(results);
		} catch (err) {
			next.reject(err instanceof Error ? err : new Error(String(err)));
		} finally {
			this.processingBatches--;
			this.processBatchQueue();
		}
	}

	// ── Similarity Search ──────────────────────────────────────────────────────

	async similaritySearch(query: string, limit = 5, minScore = 0.5): Promise<ISimilaritySearchResult[]> {
		// Generate embedding for query
		const embedding = await this.generateEmbedding(query, this.DEFAULT_DIMENSIONS);

		return this.searchWithEmbedding(embedding.vector, limit, minScore);
	}

	async searchWithEmbedding(
		embedding: number[],
		limit = 5,
		minScore = 0.5
	): Promise<ISimilaritySearchResult[]> {
		const results: Array<ISimilaritySearchResult & { score: number }> = [];

		for (const [chunkId, indexed] of this.index) {
			const score = this.cosineSimilarity(embedding, indexed.result.vector);

			if (score >= minScore) {
				results.push({
					chunkId,
					content: indexed.content,
					score,
					uri: indexed.uri,
					startLine: 0,
					endLine: 0,
				});
			}
		}

		// Sort by score descending
		results.sort((a, b) => b.score - a.score);

		// Apply limit
		return results.slice(0, limit).map(r => ({
			chunkId: r.chunkId,
			content: r.content,
			score: r.score,
			uri: r.uri,
			startLine: r.startLine,
			endLine: r.endLine,
		}));
	}

	// ── Chunk Management ───────────────────────────────────────────────────────

	chunkText(text: string, maxChunkSize: number, overlap = 0): string[] {
		const chunks: string[] = [];

		// Simple chunking by token estimate
		const tokens = this.tokenize(text);
		const overlapTokens = Math.floor(overlap);

		if (tokens.length <= maxChunkSize) {
			return [text];
		}

		let start = 0;
		while (start < tokens.length) {
			const end = Math.min(start + maxChunkSize, tokens.length);
			const chunkTokens = tokens.slice(start, end);
			chunks.push(chunkTokens.join(' '));

			// Move start forward with overlap
			start = end - overlapTokens;

			// Prevent infinite loop
			if (start >= tokens.length) {
				break;
			}
		}

		return chunks;
	}

	async embedDocument(uri: string, content: string, options?: IEmbeddingOptions): Promise<IEmbeddingResult[]> {
		// Chunk the document
		const maxChunkTokens = 512;
		const chunks = this.chunkText(content, maxChunkTokens, 50);

		// Generate chunk IDs
		const chunkIds = chunks.map((_, idx) => `${uri.replace(/[:\/]/g, '_')}-chunk-${idx}`);

		// Create batch request
		const request: IBatchEmbeddingRequest = {
			texts: chunks,
			chunkIds,
			priority: options?.dimensions || 0,
		};

		// Embed all chunks
		const results = await this.embedBatch(request);

		// Index with URI
		for (let i = 0; i < results.length; i++) {
			this.index.set(results[i].chunkId, {
				result: results[i],
				uri,
				content: chunks[i],
			});
		}

		return results;
	}

	// ── Index Management ───────────────────────────────────────────────────────

	indexEmbeddings(results: IEmbeddingResult[]): void {
		for (const result of results) {
			this.index.set(result.chunkId, {
				result,
				uri: '',
				content: result.text,
			});
		}

		// Update runtime state
		const stats = this.getStats();
		this.runtimeStateService.updateProviders({
			embeddingStats: stats,
		});
	}

	removeFromIndex(chunkIds: string[]): void {
		for (const chunkId of chunkIds) {
			this.index.delete(chunkId);
		}

		const stats = this.getStats();
		this.runtimeStateService.updateProviders({
			embeddingStats: stats,
		});
	}

	clearIndex(): void {
		this.index.clear();

		const stats = this.getStats();
		this.runtimeStateService.updateProviders({
			embeddingStats: stats,
		});

		this.logService.info('Embedding index cleared');
	}

	// ── Statistics ───────────────────────────────────────────────────────────

	getStats() {
		let totalDimensions = 0;
		let count = 0;

		for (const indexed of this.index.values()) {
			totalDimensions += indexed.result.dimensions;
			count++;
		}

		return {
			totalEmbeddings: this.index.size,
			totalChunks: this.index.size,
			averageDimensions: count > 0 ? Math.round(totalDimensions / count) : 0,
		};
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private async generateEmbedding(text: string, dimensions: number): Promise<number[]> {
		// Placeholder for actual embedding generation
		// In production, this would call the embedding provider
		const vector: number[] = [];

		// Simple hash-based embedding for demonstration
		// This creates consistent but meaningless vectors
		const hash = this.hashString(text);
		for (let i = 0; i < dimensions; i++) {
			vector.push((Math.sin(hash + i) + 1) / 2);
		}

		return vector;
	}

	private getDefaultModel(): string {
		// Default embedding model name
		return 'text-embedding-3-small';
	}

	private tokenize(text: string): string[] {
		// Simple tokenization
		return text
			.split(/\s+/)
			.filter(t => t.length > 0);
	}

	private hashString(str: string): number {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash;
		}
		return Math.abs(hash);
	}

	private cosineSimilarity(a: number[], b: number[]): number {
		if (a.length !== b.length) {
			return 0;
		}

		let dotProduct = 0;
		let normA = 0;
		let normB = 0;

		for (let i = 0; i < a.length; i++) {
			dotProduct += a[i] * b[i];
			normA += a[i] * a[i];
			normB += b[i] * b[i];
		}

		const denominator = Math.sqrt(normA) * Math.sqrt(normB);
		return denominator > 0 ? dotProduct / denominator : 0;
	}
}
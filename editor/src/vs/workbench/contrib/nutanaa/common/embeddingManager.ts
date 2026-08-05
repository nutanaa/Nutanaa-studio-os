/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import {
	IEmbeddingResult,
	IBatchEmbeddingRequest,
	ISimilaritySearchResult,
	IEmbeddingOptions,
} from '../models/aiCore.js';

/**
 * Service for managing embeddings in Nutanaa Studio OS.
 *
 * Responsibilities:
 * - Generate embeddings for text
 * - Batch embedding processing
 * - Similarity search
 * - Chunk embeddings for large content
 */
export const IEmbeddingManager = createDecorator<IEmbeddingManager>('nutanaaEmbeddingManager');

export interface IEmbeddingManager {

	// ── Single Embeddings ──────────────────────────────────────────────────────

	/**
	 * Generate embedding for a single text.
	 * @param text The text to embed
	 * @param options Embedding options
	 * @returns Embedding result
	 */
	embed(text: string, options?: IEmbeddingOptions): Promise<IEmbeddingResult>;

	// ── Batch Embeddings ───────────────────────────────────────────────────────

	/**
	 * Generate embeddings for multiple texts.
	 * @param request Batch embedding request
	 * @returns Array of embedding results
	 */
	embedBatch(request: IBatchEmbeddingRequest): Promise<IEmbeddingResult[]>;

	/**
	 * Queue a batch embedding request.
	 * @param request Batch request
	 * @returns Promise that resolves when complete
	 */
	queueBatch(request: IBatchEmbeddingRequest): Promise<IEmbeddingResult[]>;

	// ── Similarity Search ──────────────────────────────────────────────────────

	/**
	 * Search for similar content using embeddings.
	 * @param query The search query
	 * @param limit Maximum results
	 * @param minScore Minimum similarity score
	 * @returns Array of search results
	 */
	similaritySearch(query: string, limit?: number, minScore?: number): Promise<ISimilaritySearchResult[]>;

	/**
	 * Search with specific embeddings.
	 * @param embedding The query embedding vector
	 * @param limit Maximum results
	 * @param minScore Minimum similarity score
	 * @returns Array of search results
	 */
	searchWithEmbedding(embedding: number[], limit?: number, minScore?: number): Promise<ISimilaritySearchResult[]>;

	// ── Chunk Management ───────────────────────────────────────────────────────

	/**
	 * Chunk large text for embedding.
	 * @param text The text to chunk
	 * @param maxChunkSize Maximum chunk size in tokens
	 * @param overlap Overlap between chunks
	 * @returns Array of text chunks
	 */
	chunkText(text: string, maxChunkSize: number, overlap?: number): string[];

	/**
	 * Embed a large document by chunking.
	 * @param uri The document URI
	 * @param content The document content
	 * @param options Embedding options
	 * @returns Array of embedding results for each chunk
	 */
	embedDocument(uri: string, content: string, options?: IEmbeddingOptions): Promise<IEmbeddingResult[]>;

	// ── Index Management ───────────────────────────────────────────────────────

	/**
	 * Add embeddings to the index.
	 * @param results Embedding results to add
	 */
	indexEmbeddings(results: IEmbeddingResult[]): void;

	/**
	 * Remove embeddings from the index.
	 * @param chunkIds Chunk IDs to remove
	 */
	removeFromIndex(chunkIds: string[]): void;

	/**
	 * Clear the embedding index.
	 */
	clearIndex(): void;

	// ── Statistics ───────────────────────────────────────────────────────────

	/**
	 * Get embedding statistics.
	 * @returns Statistics object
	 */
	getStats(): {
		readonly totalEmbeddings: number;
		readonly totalChunks: number;
		readonly averageDimensions: number;
	};

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when embeddings are created.
	 */
	onDidCreateEmbedding: (listener: (result: IEmbeddingResult) => void) => { dispose(): void };
}
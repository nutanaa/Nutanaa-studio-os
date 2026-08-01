// File: src/vs/workbench/contrib/nutanaa/models/embeddingModel.ts

import { URI } from '../../../../base/common/uri.js';

export interface IEmbeddingVector {
	readonly id: string;
	readonly chunkId: string;
	readonly uri: URI;
	readonly vector: number[];
	readonly dimensions: number;
	readonly modelName: string;
}

export interface IEmbeddingRequest {
	readonly id: string;
	readonly text: string;
	readonly chunkId: string;
	readonly uri: URI;
	readonly priority: number;
}

export interface IVectorSearchResult {
	readonly chunkId: string;
	readonly uri: URI;
	readonly score: number;
	readonly content: string;
	readonly startLine: number;
	readonly endLine: number;
}
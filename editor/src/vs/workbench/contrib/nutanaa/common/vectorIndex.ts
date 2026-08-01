// File: src/vs/workbench/contrib/nutanaa/common/vectorIndex.ts

import { IEmbeddingVector, IVectorSearchResult } from '../models/embeddingModel.js';
import { ICodeChunk } from '../models/workspaceModel.js';

export class VectorIndex {
	private readonly vectors: Map<string, IEmbeddingVector> = new Map();
	private readonly chunks: Map<string, ICodeChunk> = new Map();

	public insert(vector: IEmbeddingVector, chunk: ICodeChunk): void {
		this.vectors.set(chunk.id, vector);
		this.chunks.set(chunk.id, chunk);
	}

	public remove(chunkId: string): void {
		this.vectors.delete(chunkId);
		this.chunks.delete(chunkId);
	}

	public clear(): void {
		this.vectors.clear();
		this.chunks.clear();
	}

	public search(queryVector: number[], topK: number = 10): IVectorSearchResult[] {
		const results: { chunkId: string; score: number }[] = [];

		for (const [chunkId, embedding] of this.vectors.entries()) {
			const score = this.cosineSimilarity(queryVector, embedding.vector);
			results.push({ chunkId, score });
		}

		results.sort((a, b) => b.score - a.score);

		return results.slice(0, topK).map(res => {
			const chunk = this.chunks.get(res.chunkId)!;
			return {
				chunkId: chunk.id,
				uri: chunk.fileUri,
				score: res.score,
				content: chunk.content,
				startLine: chunk.startLine,
				endLine: chunk.endLine
			};
		});
	}

	private cosineSimilarity(a: number[], b: number[]): number {
		if (a.length !== b.length) {
			return 0;
		}
		let dot = 0;
		let normA = 0;
		let normB = 0;
		for (let i = 0; i < a.length; i++) {
			dot += a[i] * b[i];
			normA += a[i] * a[i];
			normB += b[i] * b[i];
		}
		if (normA === 0 || normB === 0) {
			return 0;
		}
		return dot / (Math.sqrt(normA) * Math.sqrt(normB));
	}
}
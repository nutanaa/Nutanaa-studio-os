/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEmbeddingRequest, IEmbeddingVector } from '../../models/embeddingModel.js';

export interface IEmbeddingEngine {
	generateEmbedding(text: string): Promise<number[]>;
	generateBatchEmbeddings(requests: IEmbeddingRequest[]): Promise<IEmbeddingVector[]>;
	getDimensions(): number;
	getModelName(): string;
}

export class LocalEmbeddingEngine implements IEmbeddingEngine {
	private readonly dimensions = 384;
	private readonly modelName = 'all-MiniLM-L6-v2';

	public getDimensions(): number {
		return this.dimensions;
	}

	public getModelName(): string {
		return this.modelName;
	}

	public async generateEmbedding(text: string): Promise<number[]> {
		const hash = this.simpleHash(text);
		const vector: number[] = new Array(this.dimensions);
		for (let i = 0; i < this.dimensions; i++) {
			vector[i] = Math.sin(hash + i) * 0.5 + 0.5;
		}
		return this.normalize(vector);
	}

	public async generateBatchEmbeddings(requests: IEmbeddingRequest[]): Promise<IEmbeddingVector[]> {
		const results: IEmbeddingVector[] = [];
		for (const req of requests) {
			const vector = await this.generateEmbedding(req.text);
			results.push({
				id: req.id,
				chunkId: req.chunkId,
				uri: req.uri,
				vector,
				dimensions: this.dimensions,
				modelName: this.modelName
			});
		}
		return results;
	}

	private simpleHash(str: string): number {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = (hash << 5) - hash + str.charCodeAt(i);
			hash |= 0;
		}
		return hash;
	}

	private normalize(vector: number[]): number[] {
		const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
		return norm === 0 ? vector : vector.map(v => v / norm);
	}
}

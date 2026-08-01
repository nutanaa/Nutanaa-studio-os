/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IEmbeddingEngine, LocalEmbeddingEngine } from '../common/embeddingEngine.js';
import { VectorIndex } from '../common/vectorIndex.js';
import { IEmbeddingRequest, IVectorSearchResult } from '../models/embeddingModel.js';
import { ICodeChunk } from '../models/workspaceModel.js';

export const IEmbeddingService = createDecorator<IEmbeddingService>('embeddingService');

export interface IEmbeddingService {
	readonly _serviceBrand: undefined;
	indexChunk(chunk: ICodeChunk): Promise<void>;
	removeChunk(chunkId: string): void;
	searchSimilar(query: string, topK?: number): Promise<IVectorSearchResult[]>;
	clearIndex(): void;
}

export class EmbeddingService extends Disposable implements IEmbeddingService {
	declare readonly _serviceBrand: undefined;

	private readonly engine: IEmbeddingEngine;
	private readonly vectorIndex: VectorIndex;

	constructor() {
		super();
		this.engine = new LocalEmbeddingEngine();
		this.vectorIndex = new VectorIndex();
	}

	public async indexChunk(chunk: ICodeChunk): Promise<void> {
		const request: IEmbeddingRequest = {
			id: `req_${chunk.id}`,
			text: chunk.content,
			chunkId: chunk.id,
			uri: chunk.fileUri,
			priority: 1
		};
		const [vector] = await this.engine.generateBatchEmbeddings([request]);
		this.vectorIndex.insert(vector, chunk);
	}

	public removeChunk(chunkId: string): void {
		this.vectorIndex.remove(chunkId);
	}

	public async searchSimilar(query: string, topK: number = 10): Promise<IVectorSearchResult[]> {
		const queryVector = await this.engine.generateEmbedding(query);
		return this.vectorIndex.search(queryVector, topK);
	}

	public clearIndex(): void {
		this.vectorIndex.clear();
	}
}

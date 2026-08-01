// File: src/vs/workbench/contrib/nutanaa/services/semanticSearchService.ts

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IEmbeddingService } from '../services/embeddingService.js';
import { ISemanticSearchQuery, ISemanticSearchResponse } from '../models/semanticSearchModel.js';

export const ISemanticSearchService = createDecorator<ISemanticSearchService>('semanticSearchService');

export interface ISemanticSearchService {
	readonly _serviceBrand: undefined;
	executeSearch(query: ISemanticSearchQuery): Promise<ISemanticSearchResponse>;
}

export class SemanticSearchService extends Disposable implements ISemanticSearchService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IEmbeddingService private readonly embeddingService: IEmbeddingService
	) {
		super();
	}

	public async executeSearch(query: ISemanticSearchQuery): Promise<ISemanticSearchResponse> {
		const startTime = Date.now();
		const topK = query.topK ?? 10;
		const minSimilarity = query.minSimilarity ?? 0.0;

		const rawResults = await this.embeddingService.searchSimilar(query.query, topK);

		const filteredResults = rawResults
			.filter(res => res.score >= minSimilarity)
			.map(res => ({
				uri: res.uri,
				chunkId: res.chunkId,
				content: res.content,
				startLine: res.startLine,
				endLine: res.endLine,
				similarityScore: res.score
			}));

		return {
			query: query.query,
			matches: filteredResults,
			executionTimeMs: Date.now() - startTime
		};
	}
}
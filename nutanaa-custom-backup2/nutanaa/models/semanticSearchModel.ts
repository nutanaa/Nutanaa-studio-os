// File: src/vs/workbench/contrib/nutanaa/models/semanticSearchModel.ts

import { URI } from '../../../../base/common/uri.js';

export interface ISemanticSearchQuery {
	readonly query: string;
	readonly topK?: number;
	readonly fileFilters?: string[];
	readonly languageFilters?: string[];
	readonly minSimilarity?: number;
}

export interface ISemanticMatch {
	readonly uri: URI;
	readonly chunkId: string;
	readonly content: string;
	readonly startLine: number;
	readonly endLine: number;
	readonly similarityScore: number;
}

export interface ISemanticSearchResponse {
	readonly query: string;
	readonly matches: ISemanticMatch[];
	readonly executionTimeMs: number;
}
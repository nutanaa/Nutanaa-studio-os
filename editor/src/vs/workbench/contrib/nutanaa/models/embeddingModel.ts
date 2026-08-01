/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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

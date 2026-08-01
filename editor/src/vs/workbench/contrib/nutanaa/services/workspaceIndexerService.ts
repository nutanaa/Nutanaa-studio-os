/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { WorkspaceIndexer } from '../common/indexer/workspaceIndexer.js';
import { IEmbeddingService } from '../services/embeddingService.js';
import { IWorkspaceSymbol } from '../models/workspaceModel.js';

export const IWorkspaceIndexerService = createDecorator<IWorkspaceIndexerService>('workspaceIndexerService');

export interface IWorkspaceIndexerService {
	readonly _serviceBrand: undefined;
	readonly indexer: WorkspaceIndexer;

	indexFile(uri: URI, content: string, mtime?: number): Promise<void>;
	removeFile(uri: URI): void;
	getAllSymbols(): IWorkspaceSymbol[];
}

export class WorkspaceIndexerService extends Disposable implements IWorkspaceIndexerService {
	declare readonly _serviceBrand: undefined;

	public readonly indexer = new WorkspaceIndexer();

	constructor(
		@IEmbeddingService private readonly embeddingService: IEmbeddingService
	) {
		super();
	}

	public async indexFile(uri: URI, content: string, mtime: number = Date.now()): Promise<void> {
		const { chunks } = await this.indexer.indexFile(uri, content, mtime);
		for (const chunk of chunks) {
			await this.embeddingService.indexChunk(chunk);
		}
	}

	public removeFile(uri: URI): void {
		const chunks = this.indexer.getChunksForFile(uri);
		for (const chunk of chunks) {
			this.embeddingService.removeChunk(chunk.id);
		}
		this.indexer.removeFile(uri);
	}

	public getAllSymbols(): IWorkspaceSymbol[] {
		return this.indexer.getSymbols();
	}
}

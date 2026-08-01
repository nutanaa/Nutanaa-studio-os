// File: src/vs/workbench/contrib/nutanaa/common/indexer/workspaceIndexer.ts

import { URI } from '../../../../../base/common/uri.js';
import { ChunkManager } from '../../common/indexer/chunkManager.js';
import { DocumentParser } from '../../common/indexer/documentParser.js';
import { LanguageDetector } from '../../common/indexer/languageDetector.js';
import { RelationshipEngine } from '../../common/graph/relationshipEngine.js';
import { ICodeChunk, IWorkspaceFileNode, IWorkspaceSymbol } from '../../models/workspaceModel.js';

export class WorkspaceIndexer {
	private readonly documentParser = new DocumentParser();
	private readonly chunkManager = new ChunkManager();
	private readonly relationshipEngine = new RelationshipEngine();

	private readonly fileNodes: Map<string, IWorkspaceFileNode> = new Map();
	private readonly symbolStore: Map<string, IWorkspaceSymbol> = new Map();
	private readonly chunkStore: Map<string, ICodeChunk[]> = new Map();

	public async indexFile(uri: URI, content: string, mtime: number): Promise<{ chunks: ICodeChunk[]; symbols: IWorkspaceSymbol[] }> {
		const languageId = LanguageDetector.detect(uri);
		const hash = this.simpleHash(content);

		const fileNode: IWorkspaceFileNode = {
			uri,
			languageId,
			size: content.length,
			mtime,
			hash
		};
		this.fileNodes.set(uri.toString(), fileNode);

		const parsed = this.documentParser.parse(uri, languageId, content);
		for (const sym of parsed.symbols) {
			this.symbolStore.set(sym.id, sym);
		}

		const chunks = this.chunkManager.createChunks(uri, content);
		this.chunkStore.set(uri.toString(), chunks);

		this.relationshipEngine.processFileRelationships(
			uri,
			parsed.imports,
			parsed.exports,
			parsed.symbols,
			content
		);

		return { chunks, symbols: parsed.symbols };
	}

	public removeFile(uri: URI): void {
		const uriStr = uri.toString();
		this.fileNodes.delete(uriStr);
		this.chunkStore.delete(uriStr);
		this.relationshipEngine.removeFile(uri);

		for (const [key, sym] of this.symbolStore.entries()) {
			if (sym.location.uri.toString() === uriStr) {
				this.symbolStore.delete(key);
			}
		}
	}

	public getFileNode(uri: URI): IWorkspaceFileNode | undefined {
		return this.fileNodes.get(uri.toString());
	}

	public getSymbols(): IWorkspaceSymbol[] {
		return Array.from(this.symbolStore.values());
	}

	public getChunksForFile(uri: URI): ICodeChunk[] {
		return this.chunkStore.get(uri.toString()) || [];
	}

	public getRelationshipEngine(): RelationshipEngine {
		return this.relationshipEngine;
	}

	private simpleHash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = (hash << 5) - hash + str.charCodeAt(i);
			hash |= 0;
		}
		return hash.toString(16);
	}
}
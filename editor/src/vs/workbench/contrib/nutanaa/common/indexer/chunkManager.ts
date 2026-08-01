// File: src/vs/workbench/contrib/nutanaa/common/indexer/chunkManager.ts

import { URI } from '../../../../../base/common/uri.js';
import { ICodeChunk } from '../../models/workspaceModel.js';

export class ChunkManager {
	private readonly targetChunkLines: number = 30;
	private readonly overlapLines: number = 5;

	public createChunks(uri: URI, content: string): ICodeChunk[] {
		const lines = content.split(/\r?\n/);
		const chunks: ICodeChunk[] = [];

		if (lines.length === 0) {
			return chunks;
		}

		let startLine = 0;
		let chunkIdx = 0;

		while (startLine < lines.length) {
			const endLine = Math.min(startLine + this.targetChunkLines, lines.length);
			const chunkContent = lines.slice(startLine, endLine).join('\n');
			const chunkId = `${uri.toString()}#chunk_${chunkIdx++}`;

			chunks.push({
				id: chunkId,
				fileUri: uri,
				startLine: startLine + 1,
				endLine,
				content: chunkContent,
				tokenCount: this.estimateTokens(chunkContent),
				hash: this.simpleHash(chunkContent)
			});

			if (endLine >= lines.length) {
				break;
			}

			startLine += (this.targetChunkLines - this.overlapLines);
		}

		return chunks;
	}

	private estimateTokens(text: string): number {
		return Math.ceil(text.length / 4);
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
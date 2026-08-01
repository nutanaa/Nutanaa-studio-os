// File: src/vs/workbench/contrib/nutanaa/common/indexer/documentParser.ts

import { URI } from '../../../../../base/common/uri.js';
import { IWorkspaceSymbol } from '../../models/workspaceModel.js';

export interface IParsedDocument {
	readonly uri: URI;
	readonly languageId: string;
	readonly symbols: IWorkspaceSymbol[];
	readonly imports: string[];
	readonly exports: string[];
}

export class DocumentParser {
	public parse(uri: URI, languageId: string, content: string): IParsedDocument {
		const symbols: IWorkspaceSymbol[] = [];
		const imports: string[] = [];
		const exports: string[] = [];

		const lines = content.split(/\r?\n/);

		lines.forEach((line, index) => {
			const trimmed = line.trim();

			if (trimmed.startsWith('import ')) {
				const match = trimmed.match(/from\ ['"]([^'"]+)['"]/);
				if (match) {
					imports.push(match[1]);
				}
			}

			if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
				const match = trimmed.match(/(?:from|import)\s+([a-zA-Z0-9_\.]+)/);
				if (match && !imports.includes(match[1])) {
					imports.push(match[1]);
				}
			}

			const classMatch = trimmed.match(/(?:export\s+)?class\s+([a-zA-Z0-9_]+)/);
			if (classMatch) {
				symbols.push({
					id: `${uri.toString()}#class:${classMatch[1]}`,
					name: classMatch[1],
					kind: 'class',
					location: { uri, startLine: index + 1, startColumn: 1, endLine: index + 1, endColumn: line.length }
				});
			}

			const functionMatch = trimmed.match(/(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)/) ||
				trimmed.match(/def\s+([a-zA-Z0-9_]+)\s*\(/);
			if (functionMatch) {
				symbols.push({
					id: `${uri.toString()}#function:${functionMatch[1]}`,
					name: functionMatch[1],
					kind: 'function',
					location: { uri, startLine: index + 1, startColumn: 1, endLine: index + 1, endColumn: line.length }
				});
			}

			if (trimmed.startsWith('export ')) {
				exports.push(trimmed);
			}
		});

		return { uri, languageId, symbols, imports, exports };
	}
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { IReferenceNode, IWorkspaceSymbol } from '../../models/workspaceModel.js';

export class ReferenceAnalyzer {
	private readonly referenceMap: Map<string, IReferenceNode> = new Map();

	public analyzeReferences(symbol: IWorkspaceSymbol, targetUri: URI, content: string): IReferenceNode {
		const references: Array<{ uri: URI; line: number; column: number }> = [];
		const lines = content.split(/\r?\n/);
		const symbolName = symbol.name;

		lines.forEach((line, index) => {
			let col = line.indexOf(symbolName);
			while (col !== -1) {
				references.push({
					uri: targetUri,
					line: index + 1,
					column: col + 1
				});
				col = line.indexOf(symbolName, col + symbolName.length);
			}
		});

		const node: IReferenceNode = {
			symbolId: symbol.id,
			targetUri,
			references
		};

		this.referenceMap.set(symbol.id, node);
		return node;
	}

	public getReferences(symbolId: string): IReferenceNode | undefined {
		return this.referenceMap.get(symbolId);
	}

	public clearForUri(uri: URI): void {
		const uriStr = uri.toString();
		for (const [key, val] of this.referenceMap.entries()) {
			if (val.targetUri.toString() === uriStr) {
				this.referenceMap.delete(key);
			}
		}
	}
}

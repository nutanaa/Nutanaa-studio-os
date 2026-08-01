/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { CallGraphBuilder } from '../../common/graph/callGraphBuilder.js';
import { DependencyAnalyzer } from '../../common/graph/dependencyAnalyzer.js';
import { KnowledgeGraphBuilder } from '../../common/graph/knowledgeGraphBuilder.js';
import { ReferenceAnalyzer } from '../../common/graph/referenceAnalyzer.js';
import { IWorkspaceSymbol } from '../../models/workspaceModel.js';

export class RelationshipEngine {
	private readonly dependencyAnalyzer: DependencyAnalyzer;
	private readonly referenceAnalyzer: ReferenceAnalyzer;
	private readonly callGraphBuilder: CallGraphBuilder;
	private readonly knowledgeGraphBuilder: KnowledgeGraphBuilder;

	constructor() {
		this.dependencyAnalyzer = new DependencyAnalyzer();
		this.referenceAnalyzer = new ReferenceAnalyzer();
		this.callGraphBuilder = new CallGraphBuilder();
		this.knowledgeGraphBuilder = new KnowledgeGraphBuilder();
	}

	public processFileRelationships(
		uri: URI,
		imports: string[],
		exports: string[],
		symbols: IWorkspaceSymbol[],
		content: string
	): void {
		const fileNodeId = uri.toString();
		this.knowledgeGraphBuilder.addNode(fileNodeId, uri.path.split('/').pop() || fileNodeId, 'file', uri);

		this.dependencyAnalyzer.analyzeFile(uri, imports, exports);

		for (const imp of imports) {
			this.knowledgeGraphBuilder.addNode(imp, imp, 'module');
			this.knowledgeGraphBuilder.addEdge(fileNodeId, imp, 'imports');
		}

		for (const symbol of symbols) {
			const symbolKind = symbol.kind as 'class' | 'function' | 'interface';
			this.knowledgeGraphBuilder.addNode(symbol.id, symbol.name, symbolKind || 'concept', uri);
			this.knowledgeGraphBuilder.addEdge(fileNodeId, symbol.id, 'references');

			this.referenceAnalyzer.analyzeReferences(symbol, uri, content);
			this.callGraphBuilder.buildNode(symbol, symbols, content);
		}
	}

	public getKnowledgeGraph() {
		return this.knowledgeGraphBuilder.getGraphData();
	}

	public getDependencies() {
		return this.dependencyAnalyzer.getDependencyGraph();
	}

	public removeFile(uri: URI): void {
		const fileNodeId = uri.toString();
		this.knowledgeGraphBuilder.removeNode(fileNodeId);
		this.dependencyAnalyzer.removeFile(uri);
		this.referenceAnalyzer.clearForUri(uri);
	}
}

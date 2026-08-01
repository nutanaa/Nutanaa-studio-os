// File: src/vs/workbench/contrib/nutanaa/common/graph/knowledgeGraphBuilder.ts

import { URI } from '../../../../../base/common/uri.js';
import {
	IKnowledgeGraphData,
	IKnowledgeGraphEdge,
	IKnowledgeGraphNode,
	KnowledgeNodeType,
	KnowledgeRelationType
} from '../../models/knowledgeGraphModel.js';

export class KnowledgeGraphBuilder {
	private readonly nodes: Map<string, IKnowledgeGraphNode> = new Map();
	private readonly edges: Map<string, IKnowledgeGraphEdge> = new Map();

	public addNode(id: string, label: string, type: KnowledgeNodeType, uri?: URI, properties?: Record<string, any>): IKnowledgeGraphNode {
		const node: IKnowledgeGraphNode = { id, label, type, uri, properties };
		this.nodes.set(id, node);
		return node;
	}

	public addEdge(sourceId: string, targetId: string, relation: KnowledgeRelationType, weight: number = 1.0): IKnowledgeGraphEdge | undefined {
		if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) {
			return undefined;
		}

		const id = `${sourceId}_${relation}_${targetId}`;
		const edge: IKnowledgeGraphEdge = { id, sourceId, targetId, relation, weight };
		this.edges.set(id, edge);
		return edge;
	}

	public removeNode(id: string): void {
		this.nodes.delete(id);
		for (const [edgeId, edge] of this.edges.entries()) {
			if (edge.sourceId === id || edge.targetId === id) {
				this.edges.delete(edgeId);
			}
		}
	}

	public getGraphData(): IKnowledgeGraphData {
		return {
			nodes: Array.from(this.nodes.values()),
			edges: Array.from(this.edges.values())
		};
	}

	public clear(): void {
		this.nodes.clear();
		this.edges.clear();
	}
}
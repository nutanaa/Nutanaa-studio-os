// File: src/vs/workbench/contrib/nutanaa/models/knowledgeGraphModel.ts

import { URI } from '../../../../base/common/uri.js';

export type KnowledgeNodeType = 'file' | 'class' | 'function' | 'interface' | 'module' | 'concept' | 'memory';

export type KnowledgeRelationType = 'imports' | 'extends' | 'implements' | 'calls' | 'references' | 'relates_to' | 'depends_on';

export interface IKnowledgeGraphNode {
	readonly id: string;
	readonly label: string;
	readonly type: KnowledgeNodeType;
	readonly uri?: URI;
	readonly properties?: Record<string, any>;
}

export interface IKnowledgeGraphEdge {
	readonly id: string;
	readonly sourceId: string;
	readonly targetId: string;
	readonly relation: KnowledgeRelationType;
	readonly weight: number;
}

export interface IKnowledgeGraphData {
	readonly nodes: IKnowledgeGraphNode[];
	readonly edges: IKnowledgeGraphEdge[];
}
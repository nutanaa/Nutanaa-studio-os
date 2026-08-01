// File: src/vs/workbench/contrib/nutanaa/models/workspaceModel.ts

import { URI } from '../../../../base/common/uri.js';

export interface IWorkspaceFileNode {
	readonly uri: URI;
	readonly languageId: string;
	readonly size: number;
	readonly mtime: number;
	readonly hash: string;
}

export interface ICodeChunk {
	readonly id: string;
	readonly fileUri: URI;
	readonly startLine: number;
	readonly endLine: number;
	readonly content: string;
	readonly tokenCount: number;
	readonly hash: string;
}

export interface IWorkspaceSymbol {
	readonly id: string;
	readonly name: string;
	readonly kind: string;
	readonly location: {
		readonly uri: URI;
		readonly startLine: number;
		readonly startColumn: number;
		readonly endLine: number;
		readonly endColumn: number;
	};
	readonly containerName?: string;
}

export interface IDependencyNode {
	readonly id: string;
	readonly uri: URI;
	readonly imports: string[];
	readonly exports: string[];
	readonly internalDependencies: string[];
	readonly externalDependencies: string[];
}

export interface ICallGraphNode {
	readonly symbolId: string;
	readonly name: string;
	readonly location: { readonly uri: URI; readonly line: number };
	readonly calls: string[];
	readonly calledBy: string[];
}

export interface IReferenceNode {
	readonly symbolId: string;
	readonly targetUri: URI;
	readonly references: Array<{ readonly uri: URI; readonly line: number; readonly column: number }>;
}

export interface IWorkspaceTimelineEvent {
	readonly id: string;
	readonly timestamp: number;
	readonly type: 'file_create' | 'file_modify' | 'file_delete' | 'git_commit' | 'refactor';
	readonly uri: URI;
	readonly summary: string;
}
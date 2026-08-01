/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import {
	ITreeItem,
	ITreeViewDataProvider,
	TreeItemCollapsibleState
} from '../../../common/views.js';

export class ProjectKnowledgeDataProvider extends Disposable implements ITreeViewDataProvider {

	private readonly _onDidChangeTreeData = new Emitter<ITreeItem[] | void>();
	readonly onDidChangeTreeData: Event<ITreeItem[] | void> = this._onDidChangeTreeData.event;

	constructor() {
		super();
	}

	async getChildren(element?: ITreeItem): Promise<ITreeItem[]> {

		if (!element) {
			return [
				{
					handle: 'knowledge-codebase',
					label: { label: 'Codebase Knowledge' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				},
				{
					handle: 'knowledge-docs',
					label: { label: 'Documentation' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				},
				{
					handle: 'knowledge-rag',
					label: { label: 'RAG Collections' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				}
			];
		}

		switch (element.handle) {

			case 'knowledge-codebase':
				return [
					{
						handle: 'ast',
						label: { label: 'AST Index' },
						collapsibleState: TreeItemCollapsibleState.None
					}
				];

			case 'knowledge-docs':
				return [
					{
						handle: 'architecture',
						label: { label: 'Architecture Docs' },
						collapsibleState: TreeItemCollapsibleState.None
					}
				];

			case 'knowledge-rag':
				return [
					{
						handle: 'vectordb',
						label: { label: 'Chroma Vector DB' },
						collapsibleState: TreeItemCollapsibleState.None
					}
				];
		}

		return [];
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}
}

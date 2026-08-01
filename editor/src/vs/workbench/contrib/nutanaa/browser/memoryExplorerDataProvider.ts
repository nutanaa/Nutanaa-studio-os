/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import {
	ITreeItem,
	ITreeViewDataProvider,
	TreeItemCollapsibleState
} from '../../../common/views.js';
import { Disposable } from '../../../../base/common/lifecycle.js';

export class MemoryExplorerDataProvider extends Disposable implements ITreeViewDataProvider {

	private readonly _onDidChangeTreeData = new Emitter<ITreeItem[] | void>();
	readonly onDidChangeTreeData: Event<ITreeItem[] | void> = this._onDidChangeTreeData.event;

	async getChildren(element?: ITreeItem): Promise<ITreeItem[]> {

		if (!element) {
			return [
				{
					handle: 'memory-workspace',
					label: { label: 'Workspace Memory' },
					collapsibleState: TreeItemCollapsibleState.None
				},
				{
					handle: 'memory-project',
					label: { label: 'Project Memory' },
					collapsibleState: TreeItemCollapsibleState.None
				},
				{
					handle: 'memory-global',
					label: { label: 'Global Memory' },
					collapsibleState: TreeItemCollapsibleState.None
				},
				{
					handle: 'memory-character',
					label: { label: 'Character Memory' },
					collapsibleState: TreeItemCollapsibleState.None
				},
				{
					handle: 'memory-story',
					label: { label: 'Story Bible' },
					collapsibleState: TreeItemCollapsibleState.None
				},
				{
					handle: 'memory-prompts',
					label: { label: 'Prompt Library' },
					collapsibleState: TreeItemCollapsibleState.None
				},
				{
					handle: 'memory-vectordb',
					label: { label: 'Vector Database' },
					collapsibleState: TreeItemCollapsibleState.None
				},
				{
					handle: 'memory-embeddings',
					label: { label: 'Embeddings' },
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

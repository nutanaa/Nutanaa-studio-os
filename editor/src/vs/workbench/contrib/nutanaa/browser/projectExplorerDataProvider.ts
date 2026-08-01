/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import {
	ITreeItem,
	ITreeViewDataProvider,
	TreeItemCollapsibleState
} from '../../../common/views.js';

export class ProjectExplorerDataProvider extends Disposable implements ITreeViewDataProvider {

	private readonly _onDidChangeTreeData = new Emitter<ITreeItem[] | void>();
	readonly onDidChangeTreeData: Event<ITreeItem[] | void> = this._onDidChangeTreeData.event;

	constructor() {
		super();
	}

	async getChildren(element?: ITreeItem): Promise<ITreeItem[]> {

		if (!element) {
			return [
				{
					handle: 'recentProjects',
					label: { label: 'Recent Projects' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				},
				{
					handle: 'templates',
					label: { label: 'Project Templates' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				},
				{
					handle: 'workspace',
					label: { label: 'Workspace Metadata' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				}
			];
		}

		switch (element.handle) {

			case 'recentProjects':
				return [
					{
						handle: 'sample1',
						label: { label: 'AI Studio OS' },
						collapsibleState: TreeItemCollapsibleState.None
					}
				];

			case 'templates':
				return [
					{
						handle: 'template-python',
						label: { label: 'Python Agent Project' },
						collapsibleState: TreeItemCollapsibleState.None
					},
					{
						handle: 'template-typescript',
						label: { label: 'TypeScript Extension' },
						collapsibleState: TreeItemCollapsibleState.None
					}
				];

			case 'workspace':
				return [
					{
						handle: 'workspaceInfo',
						label: { label: 'Workspace.json' },
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

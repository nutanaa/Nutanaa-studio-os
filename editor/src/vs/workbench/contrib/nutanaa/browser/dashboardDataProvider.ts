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

export class DashboardDataProvider extends Disposable implements ITreeViewDataProvider {

	private readonly _onDidChangeTreeData = new Emitter<ITreeItem[] | void>();

	readonly onDidChangeTreeData: Event<ITreeItem[] | void> = this._onDidChangeTreeData.event;

	constructor() {
		super();
	}

	async getChildren(element?: ITreeItem): Promise<ITreeItem[]> {

		if (!element) {

			return [

				{
					handle: 'runtime',
					label: { label: 'Runtime Status' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				},

				{
					handle: 'agents',
					label: { label: 'Active Agents' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				},

				{
					handle: 'providers',
					label: { label: 'Providers' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				},

				{
					handle: 'memory',
					label: { label: 'Memory Usage' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				},

				{
					handle: 'project',
					label: { label: 'Current Project' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				},

				{
					handle: 'chat',
					label: { label: 'Recent Chats' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				},

				{
					handle: 'quickactions',
					label: { label: 'Quick Actions' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				}

			];
		}

		switch (element.handle) {

			case 'runtime':
				return [
					{
						handle: 'runtime-status',
						label: { label: 'Stopped' },
						description: 'Backend Offline',
						collapsibleState: TreeItemCollapsibleState.None
					}
				];

			case 'agents':
				return [
					{
						handle: 'agent-count',
						label: { label: 'Running Agents : 0' },
						collapsibleState: TreeItemCollapsibleState.None
					}
				];

			case 'providers':
				return [
					{
						handle: 'provider-local',
						label: { label: 'Ollama' },
						description: 'Disconnected',
						collapsibleState: TreeItemCollapsibleState.None
					},
					{
						handle: 'provider-claude',
						label: { label: 'Claude' },
						description: 'Not Configured',
						collapsibleState: TreeItemCollapsibleState.None
					}
				];

			case 'memory':
				return [
					{
						handle: 'memory-usage',
						label: { label: 'Memory Usage : 0 MB' },
						collapsibleState: TreeItemCollapsibleState.None
					}
				];

			case 'project':
				return [
					{
						handle: 'current-project',
						label: { label: 'No Project Loaded' },
						collapsibleState: TreeItemCollapsibleState.None
					}
				];

			case 'chat':
				return [
					{
						handle: 'recent-chat',
						label: { label: 'No Chat History' },
						collapsibleState: TreeItemCollapsibleState.None
					}
				];

			case 'quickactions':
				return [

					{
						handle: 'action-open-chat',
						label: { label: 'Open AI Chat' },
						collapsibleState: TreeItemCollapsibleState.None
					},

					{
						handle: 'action-start-runtime',
						label: { label: 'Start Runtime' },
						collapsibleState: TreeItemCollapsibleState.None
					},

					{
						handle: 'action-refresh',
						label: { label: 'Refresh Dashboard' },
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

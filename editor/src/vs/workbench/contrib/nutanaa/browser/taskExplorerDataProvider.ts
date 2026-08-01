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

export class TaskExplorerDataProvider extends Disposable implements ITreeViewDataProvider {

	private readonly _onDidChangeTreeData = new Emitter<ITreeItem[] | void>();
	readonly onDidChangeTreeData: Event<ITreeItem[] | void> = this._onDidChangeTreeData.event;

	constructor() {
		super();
	}

	async getChildren(element?: ITreeItem): Promise<ITreeItem[]> {

		if (!element) {
			return [
				{
					handle: 'task-running',
					label: { label: 'Running Tasks' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				},
				{
					handle: 'task-queued',
					label: { label: 'Queued Tasks' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				},
				{
					handle: 'task-completed',
					label: { label: 'Completed Tasks' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				}
			];
		}

		switch (element.handle) {

			case 'task-running':
				return [
					{
						handle: 'task-ai-build',
						label: { label: 'AI Studio Build Pipeline' },
						collapsibleState: TreeItemCollapsibleState.None
					}
				];

			case 'task-queued':
				return [
					{
						handle: 'task-test-suite',
						label: { label: 'Generate Test Suite' },
						collapsibleState: TreeItemCollapsibleState.None
					}
				];

			case 'task-completed':
				return [
					{
						handle: 'task-docs',
						label: { label: 'Documentation Generation' },
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

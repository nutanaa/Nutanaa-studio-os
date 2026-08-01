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

export class EventsDataProvider extends Disposable implements ITreeViewDataProvider {

	private readonly _onDidChangeTreeData = new Emitter<ITreeItem[] | void>();
	readonly onDidChangeTreeData: Event<ITreeItem[] | void> = this._onDidChangeTreeData.event;

	constructor() {
		super();
	}

	async getChildren(element?: ITreeItem): Promise<ITreeItem[]> {

		if (!element) {
			return [
				{
					handle: 'agentEvents',
					label: { label: 'Agent Events' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				},
				{
					handle: 'workflowEvents',
					label: { label: 'Workflow Events' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				},
				{
					handle: 'systemEvents',
					label: { label: 'System Events' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				}
			];
		}

		switch (element.handle) {

			case 'agentEvents':
				return [
					{
						handle: 'agent-start',
						label: { label: 'Agent Started' },
						collapsibleState: TreeItemCollapsibleState.None
					}
				];

			case 'workflowEvents':
				return [
					{
						handle: 'workflow-created',
						label: { label: 'Workflow Created' },
						collapsibleState: TreeItemCollapsibleState.None
					}
				];

			case 'systemEvents':
				return [
					{
						handle: 'system-ready',
						label: { label: 'Runtime Ready' },
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

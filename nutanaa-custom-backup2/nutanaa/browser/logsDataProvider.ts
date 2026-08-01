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

export class LogsDataProvider extends Disposable implements ITreeViewDataProvider {

	private readonly _onDidChangeTreeData = new Emitter<ITreeItem[] | void>();
	readonly onDidChangeTreeData: Event<ITreeItem[] | void> = this._onDidChangeTreeData.event;

	constructor() {
		super();
	}

	async getChildren(element?: ITreeItem): Promise<ITreeItem[]> {

		if (!element) {
			return [
				{
					handle: 'runtimeLogs',
					label: { label: 'Runtime Logs' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				},
				{
					handle: 'agentLogs',
					label: { label: 'Agent Logs' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				},
				{
					handle: 'systemLogs',
					label: { label: 'System Logs' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				}
			];
		}

		switch (element.handle) {

			case 'runtimeLogs':
				return [
					{
						handle: 'runtime-current',
						label: { label: 'runtime.log' },
						collapsibleState: TreeItemCollapsibleState.None
					}
				];

			case 'agentLogs':
				return [
					{
						handle: 'agent-main',
						label: { label: 'main-agent.log' },
						collapsibleState: TreeItemCollapsibleState.None
					}
				];

			case 'systemLogs':
				return [
					{
						handle: 'system',
						label: { label: 'system.log' },
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

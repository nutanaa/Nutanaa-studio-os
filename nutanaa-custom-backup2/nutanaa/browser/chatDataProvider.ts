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

export class ChatDataProvider extends Disposable implements ITreeViewDataProvider {

	private readonly _onDidChangeTreeData = new Emitter<ITreeItem[] | void>();
	readonly onDidChangeTreeData: Event<ITreeItem[] | void> = this._onDidChangeTreeData.event;

	constructor() {
		super();
	}

	async getChildren(element?: ITreeItem): Promise<ITreeItem[]> {

		if (!element) {
			return [
				{
					handle: 'chat-active',
					label: { label: 'Active Chats' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				},
				{
					handle: 'chat-history',
					label: { label: 'Chat History' },
					collapsibleState: TreeItemCollapsibleState.Collapsed
				}
			];
		}

		switch (element.handle) {

			case 'chat-active':
				return [
					{
						handle: 'chat-session',
						label: { label: 'Nutanaa Studio Session' },
						collapsibleState: TreeItemCollapsibleState.None
					}
				];

			case 'chat-history':
				return [
					{
						handle: 'chat-001',
						label: { label: 'Previous Conversation' },
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

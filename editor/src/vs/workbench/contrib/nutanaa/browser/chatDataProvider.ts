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
import { IRuntimeStateService } from '../common/runtimeState.js';
import { IRuntimeEventBus, RuntimeEventType } from '../common/runtimeEventBus.js';
import { IMemoryStats } from '../models/aiCore.js';

/**
 * Chat Data Provider for Nutanaa Studio OS.
 *
 * Provides chat session data from RuntimeState.
 */
export class ChatDataProvider extends Disposable implements ITreeViewDataProvider {

	private static readonly ACTIVE_CHAT_ID = 'chat-active';
	private static readonly HISTORY_ID = 'chat-history';

	private readonly _onDidChangeTreeData = this._register(new Emitter<ITreeItem[] | void>());
	readonly onDidChangeTreeData: Event<ITreeItem[] | void> = this._onDidChangeTreeData.event;

	constructor(
		@IRuntimeStateService private readonly stateService: IRuntimeStateService,
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
	) {
		super();

		this._register(this.stateService.onDidChangeState(() => this._onDidChangeTreeData.fire()));
		this._register(this.runtimeEventBus.on(RuntimeEventType.AgentCompleted, () => this._onDidChangeTreeData.fire()));
		this._register(this.runtimeEventBus.on(RuntimeEventType.AgentFailed, () => this._onDidChangeTreeData.fire()));
	}

	async getChildren(element?: ITreeItem): Promise<ITreeItem[]> {

		if (!element) {
			return this.buildRootItems();
		}

		const state = this.stateService.getState();
		
		switch (element.handle) {
			case ChatDataProvider.ACTIVE_CHAT_ID:
				return this.buildActiveChatItems(state);
			case ChatDataProvider.HISTORY_ID:
				return this.buildHistoryItems(state);
		}

		return [];
	}

	private buildRootItems(): ITreeItem[] {
		const state = this.stateService.getState();
		const activeSessions = Object.values(state.sessions).filter(s => s.active).length;

		return [
			{
				handle: ChatDataProvider.ACTIVE_CHAT_ID,
				label: { label: `Active Chats (${activeSessions})` },
				collapsibleState: activeSessions > 0 ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None,
				contextValue: 'nutanaaChat.active',
			},
			{
				handle: ChatDataProvider.HISTORY_ID,
				label: { label: 'Chat History' },
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: 'nutanaaChat.history',
			}
		];
	}

	private buildActiveChatItems(state: ReturnType<IRuntimeStateService['getState']>): ITreeItem[] {
		const activeSessions = Object.values(state.sessions).filter(s => s.active);

		if (activeSessions.length === 0) {
			return [{
				handle: 'chat-none',
				label: { label: 'No active chats' },
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaChat.empty',
			}];
		}

		return activeSessions.map(session => ({
			handle: `chat-session-${session.id}`,
			label: { label: session.context['title'] as string || `Session ${session.id.slice(0, 8)}` },
			description: session.agentId,
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: 'nutanaaChat.session',
		}));
	}

	private buildHistoryItems(state: ReturnType<IRuntimeStateService['getState']>): ITreeItem[] {
		const completedSessions = Object.values(state.sessions).filter(s => !s.active);

		if (completedSessions.length === 0) {
			return [{
				handle: 'history-none',
				label: { label: 'No chat history' },
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaChat.empty',
			}];
		}

		return completedSessions
			.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))
			.slice(0, 20)
			.map(session => ({
				handle: `chat-history-${session.id}`,
				label: { label: session.context['title'] as string || `Session ${session.id.slice(0, 8)}` },
				description: new Date(session.startedAt).toLocaleDateString(),
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaChat.historyItem',
			}));
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}
}

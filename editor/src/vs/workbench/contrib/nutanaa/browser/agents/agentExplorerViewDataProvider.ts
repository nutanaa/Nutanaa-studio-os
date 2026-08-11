/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../../nls.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ITreeItem, ITreeViewDataProvider, TreeItemCollapsibleState } from '../../../../common/views.js';
import { NutanaaRuntimeConnectionState } from '../../common/nutanaa.js';
import { IRuntimeStateService, IRuntimeAgentState } from '../../common/runtime/runtimeState.js';

/**
 * Populates the Agent Explorer tree from {@link IRuntimeStateService}.
 *
 * The provider subscribes to {@link IRuntimeStateService.onAgentsChanged} and
 * {@link IRuntimeStateService.onConnectionChanged} so the tree refreshes
 * automatically whenever state changes — no manual polling, no local cache.
 */
export class AgentExplorerViewDataProvider extends Disposable implements ITreeViewDataProvider {

	private static readonly DISCONNECTED_HANDLE = 'nutanaa.agentExplorer.disconnected';

	private readonly _onDidChangeTreeData = this._register(new Emitter<ITreeItem[] | void>());
	readonly onDidChangeTreeData: Event<ITreeItem[] | void> = this._onDidChangeTreeData.event;

	constructor(
		@IRuntimeStateService private readonly stateService: IRuntimeStateService,
	) {
		super();

		// Refresh the tree whenever the agents map or connection state changes.
		this._register(
			this.stateService.onAgentsChanged(() => this._onDidChangeTreeData.fire())
		);
		this._register(
			this.stateService.onConnectionChanged(() => this._onDidChangeTreeData.fire())
		);
	}

	async getChildren(element?: ITreeItem): Promise<readonly ITreeItem[] | undefined> {
		if (element) {
			// Agent nodes are leaves.
			return undefined;
		}

		const state = this.stateService.getState();
		const connectionStatus = state.connection.status;

		if (connectionStatus !== NutanaaRuntimeConnectionState.Connected) {
			return [this.buildDisconnectedItem(connectionStatus)];
		}

		const agents = Object.values(state.agents);
		if (agents.length === 0) {
			return [this.buildEmptyItem()];
		}

		return agents.map(a => this.buildAgentItem(a));
	}

	private buildDisconnectedItem(status: NutanaaRuntimeConnectionState): ITreeItem {
		const label = status === NutanaaRuntimeConnectionState.Connecting
			? localize('nutanaa.agentExplorer.connecting', "Connecting to Nutanaa Runtime…")
			: localize('nutanaa.agentExplorer.disconnected', "Not connected to Nutanaa Runtime");

		return {
			handle: AgentExplorerViewDataProvider.DISCONNECTED_HANDLE,
			label: { label },
			description: localize(
				'nutanaa.agentExplorer.disconnectedDescription',
				"Run 'Nutanaa: Refresh Agents' once the runtime is started"
			),
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: 'nutanaaAgentExplorer.disconnected',
		};
	}

	private buildEmptyItem(): ITreeItem {
		return {
			handle: 'nutanaa.agentExplorer.empty',
			label: { label: localize('nutanaa.agentExplorer.empty', "No agents are currently running") },
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: 'nutanaaAgentExplorer.empty',
		};
	}

	private buildAgentItem(entry: IRuntimeAgentState): ITreeItem {
		const { summary } = entry;
		return {
			handle: `nutanaa.agentExplorer.agent.${summary.id}`,
			label: { label: summary.name },
			description: `${summary.role} · ${summary.status}`,
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: 'nutanaaAgentExplorer.agent',
		};
	}
}

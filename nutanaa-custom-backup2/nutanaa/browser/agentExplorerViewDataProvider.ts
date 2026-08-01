/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ITreeItem, ITreeViewDataProvider, TreeItemCollapsibleState } from '../../../common/views.js';
import {
	INutanaaAgentSummary,
	INutanaaRuntimeConnectionService,
	NutanaaRuntimeConnectionState
} from '../common/nutanaa.js';

/**
 * Populates the Agent Explorer tree from {@link INutanaaRuntimeConnectionService}.
 *
 * When the runtime backend is not connected, this provider surfaces a
 * single, honest "not connected" tree item rather than fabricating agent
 * data — there is no backend bridge yet (Nutanaa Studio OS Phase 3), so
 * showing fake agents here would be actively misleading.
 */
export class AgentExplorerViewDataProvider extends Disposable implements ITreeViewDataProvider {

	private static readonly DISCONNECTED_HANDLE = 'nutanaa.agentExplorer.disconnected';

	constructor(
		@INutanaaRuntimeConnectionService private readonly runtimeConnectionService: INutanaaRuntimeConnectionService,
	) {
		super();
	}

	async getChildren(element?: ITreeItem): Promise<readonly ITreeItem[] | undefined> {
		// Only the root has children; agents themselves are leaves.
		if (element) {
			return undefined;
		}

		if (this.runtimeConnectionService.state !== NutanaaRuntimeConnectionState.Connected) {
			return [this.toDisconnectedItem()];
		}

		const agents = await this.runtimeConnectionService.getAgents();
		if (agents.length === 0) {
			return [this.toEmptyItem()];
		}

		return agents.map(agent => this.toAgentItem(agent));
	}

	private toDisconnectedItem(): ITreeItem {
		const label = this.runtimeConnectionService.state === NutanaaRuntimeConnectionState.Connecting
			? localize('nutanaa.agentExplorer.connecting', "Connecting to Nutanaa Runtime…")
			: localize('nutanaa.agentExplorer.disconnected', "Not connected to Nutanaa Runtime");

		return {
			handle: AgentExplorerViewDataProvider.DISCONNECTED_HANDLE,
			label: { label },
			description: localize('nutanaa.agentExplorer.disconnectedDescription', "Run 'Nutanaa: Refresh Agents' once the runtime is started"),
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: 'nutanaaAgentExplorer.disconnected',
		};
	}

	private toEmptyItem(): ITreeItem {
		return {
			handle: 'nutanaa.agentExplorer.empty',
			label: { label: localize('nutanaa.agentExplorer.empty', "No agents are currently running") },
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: 'nutanaaAgentExplorer.empty',
		};
	}

	private toAgentItem(agent: INutanaaAgentSummary): ITreeItem {
		return {
			handle: `nutanaa.agentExplorer.agent.${agent.id}`,
			label: { label: agent.name },
			description: `${agent.role} · ${agent.status}`,
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: 'nutanaaAgentExplorer.agent',
		};
	}
}

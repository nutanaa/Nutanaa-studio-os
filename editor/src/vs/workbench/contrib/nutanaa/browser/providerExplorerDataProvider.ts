/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ITreeItem, ITreeViewDataProvider, TreeItemCollapsibleState } from '../../../common/views.js';
import { NutanaaRuntimeConnectionState } from '../common/nutanaa.js';
import { IRuntimeStateService, IProviderState } from '../common/runtimeState.js';

/**
 * Populates the Provider Explorer tree from {@link IRuntimeStateService}.
 *
 * Subscribes to {@link IRuntimeStateService.onProvidersChanged} and
 * {@link IRuntimeStateService.onConnectionChanged}; the tree refreshes
 * automatically — no local cache, no direct calls to the connection service.
 */
export class ProviderExplorerDataProvider extends Disposable implements ITreeViewDataProvider {

	private static readonly DISCONNECTED_HANDLE = 'nutanaa.providerExplorer.disconnected';

	private readonly _onDidChangeTreeData = this._register(new Emitter<ITreeItem[] | void>());
	readonly onDidChangeTreeData: Event<ITreeItem[] | void> = this._onDidChangeTreeData.event;

	constructor(
		@IRuntimeStateService private readonly stateService: IRuntimeStateService,
	) {
		super();

		this._register(
			this.stateService.onProvidersChanged(() => this._onDidChangeTreeData.fire())
		);
		this._register(
			this.stateService.onConnectionChanged(() => this._onDidChangeTreeData.fire())
		);
	}

	async getChildren(element?: ITreeItem): Promise<readonly ITreeItem[] | undefined> {
		if (element) {
			return undefined;
		}

		const state = this.stateService.getState();
		const connectionStatus = state.connection.status;

		if (connectionStatus !== NutanaaRuntimeConnectionState.Connected) {
			return [this.buildDisconnectedItem(connectionStatus)];
		}

		const providers = Object.values(state.providers);
		if (providers.length === 0) {
			return [this.buildEmptyItem()];
		}

		return providers.map(p => this.buildProviderItem(p));
	}

	private buildDisconnectedItem(status: NutanaaRuntimeConnectionState): ITreeItem {
		const label = status === NutanaaRuntimeConnectionState.Connecting
			? localize('nutanaa.providerExplorer.connecting', "Connecting to Nutanaa Runtime…")
			: localize('nutanaa.providerExplorer.disconnected', "Not connected to Nutanaa Runtime");

		return {
			handle: ProviderExplorerDataProvider.DISCONNECTED_HANDLE,
			label: { label },
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: 'nutanaaProviderExplorer.disconnected',
		};
	}

	private buildEmptyItem(): ITreeItem {
		return {
			handle: 'nutanaa.providerExplorer.empty',
			label: { label: localize('nutanaa.providerExplorer.empty', "No providers are registered") },
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: 'nutanaaProviderExplorer.empty',
		};
	}

	private buildProviderItem(entry: IProviderState): ITreeItem {
		const { summary } = entry;
		const modelInfo = summary.activeModel
			? `${summary.activeModel} · ${summary.status}`
			: summary.status;

		return {
			handle: `nutanaa.providerExplorer.provider.${summary.id}`,
			label: { label: summary.name },
			description: modelInfo,
			tooltip: summary.message,
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: summary.healthy
				? 'nutanaaProviderExplorer.healthy'
				: 'nutanaaProviderExplorer.unhealthy',
		};
	}
}

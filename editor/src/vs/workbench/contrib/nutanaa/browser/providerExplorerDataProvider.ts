/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ITreeItem, ITreeViewDataProvider, TreeItemCollapsibleState } from '../../../common/views.js';
import {
	INutanaaProviderSummary,
	INutanaaRuntimeConnectionService,
	NutanaaRuntimeConnectionState
} from '../common/nutanaa.js';

/**
 * Populates the Provider Explorer tree from {@link INutanaaRuntimeConnectionService}.
 *
 * Previously this showed a hardcoded catalog of ~15 providers (OpenAI,
 * Anthropic, Runway, ElevenLabs, etc.) that were never actually
 * integrated — pure fiction. This now shows only providers genuinely
 * registered with the runtime (`runtime/providers/provider_manager.py`),
 * with their real, currently-measured health. When the runtime backend
 * is not connected, it surfaces a single honest "not connected" item
 * rather than fabricating a provider catalog.
 */
export class ProviderExplorerDataProvider extends Disposable implements ITreeViewDataProvider {

	private static readonly DISCONNECTED_HANDLE = 'nutanaa.providerExplorer.disconnected';

	constructor(
		@INutanaaRuntimeConnectionService private readonly runtimeConnectionService: INutanaaRuntimeConnectionService,
	) {
		super();
	}

	async getChildren(element?: ITreeItem): Promise<readonly ITreeItem[] | undefined> {
		// Only the root has children; providers themselves are leaves.
		if (element) {
			return undefined;
		}

		if (this.runtimeConnectionService.state !== NutanaaRuntimeConnectionState.Connected) {
			return [this.toDisconnectedItem()];
		}

		const providers = await this.runtimeConnectionService.getProviders();
		if (providers.length === 0) {
			return [this.toEmptyItem()];
		}

		return providers.map(provider => this.toProviderItem(provider));
	}

	private toDisconnectedItem(): ITreeItem {
		const label = this.runtimeConnectionService.state === NutanaaRuntimeConnectionState.Connecting
			? localize('nutanaa.providerExplorer.connecting', "Connecting to Nutanaa Runtime…")
			: localize('nutanaa.providerExplorer.disconnected', "Not connected to Nutanaa Runtime");

		return {
			handle: ProviderExplorerDataProvider.DISCONNECTED_HANDLE,
			label: { label },
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: 'nutanaaProviderExplorer.disconnected',
		};
	}

	private toEmptyItem(): ITreeItem {
		return {
			handle: 'nutanaa.providerExplorer.empty',
			label: { label: localize('nutanaa.providerExplorer.empty', "No providers are registered") },
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: 'nutanaaProviderExplorer.empty',
		};
	}

	private toProviderItem(provider: INutanaaProviderSummary): ITreeItem {
		const modelInfo = provider.activeModel
			? `${provider.activeModel} · ${provider.status}`
			: provider.status;

		return {
			handle: `nutanaa.providerExplorer.provider.${provider.id}`,
			label: { label: provider.name },
			description: modelInfo,
			tooltip: provider.message,
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: provider.healthy ? 'nutanaaProviderExplorer.healthy' : 'nutanaaProviderExplorer.unhealthy',
		};
	}
}
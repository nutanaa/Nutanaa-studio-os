/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import {
	IProviderManager,
} from '../../common/providers/providerManager.js';
import {
	IModelRegistry,
} from '../../common/providers/modelRegistry.js';
import { ProviderType } from '../../models/aiCore.js';
import {
	INutanaaRuntimeConnectionService,
	NutanaaRuntimeConnectionState,
	INutanaaProviderSummary,
} from '../../common/nutanaa.js';

/**
 * Service that synchronizes backend provider and model data into the
 * frontend ProviderManager and ModelRegistry.
 *
 * This is the bridge between the runtime backend's /providers endpoint
 * and the editor-side AI provider/model selection infrastructure.
 */
export class ProviderModelSyncService extends Disposable {

	declare readonly _serviceBrand: undefined;

	private syncing = false;
	private readonly syncIntervalMs = 60_000;
	private syncTimer: ReturnType<typeof setInterval> | undefined;

	constructor(
		@ILogService private readonly logService: ILogService,
		@INutanaaRuntimeConnectionService private readonly connectionService: INutanaaRuntimeConnectionService,
		@IProviderManager private readonly providerManager: IProviderManager,
		@IModelRegistry private readonly modelRegistry: IModelRegistry,
	) {
		super();

		this._register(
			this.connectionService.onDidChangeState(state => {
				if (state === NutanaaRuntimeConnectionState.Connected) {
					void this.syncFromBackend();
				} else if (state === NutanaaRuntimeConnectionState.Disconnected) {
					this.clearSyncedData();
				}
			})
		);

		this.syncTimer = setInterval(() => {
			void this.syncFromBackend();
		}, this.syncIntervalMs);

		this._register({
			dispose: () => {
				if (this.syncTimer) {
					clearInterval(this.syncTimer);
					this.syncTimer = undefined;
				}
			},
		});
	}

	/**
	 * Fetch providers from the backend and sync them into ProviderManager/ModelRegistry.
	 */
	async syncFromBackend(): Promise<void> {
		if (this.syncing) {
			return;
		}

		if (this.connectionService.state !== NutanaaRuntimeConnectionState.Connected) {
			return;
		}

		this.syncing = true;
		try {
			const summaries = await this.connectionService.getProviders();
			this.applyProviderSummaries(summaries);
		} catch (err) {
			this.logService.warn('[ProviderModelSync] failed to sync from backend.', err);
		} finally {
			this.syncing = false;
		}
	}

	/**
	 * Clear all synced provider/model data. Called on disconnect.
	 */
	private clearSyncedData(): void {
		this.providerManager.syncProviderStatuses([]);
		const allModels = this.modelRegistry.getAllModels();
		const byProvider = new Map<string, string[]>();
		for (const model of allModels) {
			const list = byProvider.get(model.provider) ?? [];
			list.push(model.id);
			byProvider.set(model.provider, list);
		}
		for (const [provider, modelNames] of byProvider) {
			this.modelRegistry.syncModels(provider as ProviderType, modelNames, '');
		}
	}

	/**
	 * Apply backend provider summaries to the frontend registries.
	 */
	private applyProviderSummaries(summaries: readonly INutanaaProviderSummary[]): void {
		this.providerManager.syncProviderStatuses(summaries);

		for (const summary of summaries) {
			const providerType = summary.type as ProviderType;
			const modelNames = summary.models;
			this.modelRegistry.syncModels(providerType, modelNames, summary.name);
		}
	}
}

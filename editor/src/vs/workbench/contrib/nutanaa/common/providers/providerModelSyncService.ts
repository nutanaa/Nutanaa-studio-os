/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

/**
 * Service responsible for synchronizing backend provider and model data
 * into the frontend ProviderManager and ModelRegistry.
 */
export const IProviderModelSyncService = createDecorator<IProviderModelSyncService>('providerModelSyncService');

export interface IProviderModelSyncService {
	readonly _serviceBrand: undefined;

	/**
	 * Fetch providers from the backend and sync them into the frontend registries.
	 */
	syncFromBackend(): Promise<void>;
}

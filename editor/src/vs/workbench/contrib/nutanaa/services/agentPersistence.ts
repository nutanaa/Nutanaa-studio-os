/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';

export const IAgentPersistenceService = createDecorator<IAgentPersistenceService>('agentPersistenceService');

export interface IAgentPersistenceService {
	readonly _serviceBrand: undefined;
	saveState(key: string, data: unknown): void;
	loadState<T>(key: string): T | undefined;
}

export class AgentPersistenceService extends Disposable implements IAgentPersistenceService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IStorageService private readonly storageService: IStorageService
	) {
		super();
	}

	public saveState(key: string, data: unknown): void {
		this.storageService.store(
			`nutanaa.agent.${key}`,
			JSON.stringify(data),
			StorageScope.WORKSPACE,
			StorageTarget.MACHINE
		);
	}

	public loadState<T>(key: string): T | undefined {
		const raw = this.storageService.get(`nutanaa.agent.${key}`, StorageScope.WORKSPACE);
		if (!raw) {
			return undefined;
		}
		try {
			return JSON.parse(raw) as T;
		} catch {
			return undefined;
		}
	}
}

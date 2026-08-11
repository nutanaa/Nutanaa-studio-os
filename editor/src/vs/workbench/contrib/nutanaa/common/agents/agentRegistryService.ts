/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IAgentConfiguration } from '../../models/agentModel.js';

export const IAgentRegistryService = createDecorator<IAgentRegistryService>('agentRegistryService');

export interface IAgentRegistryService {
	readonly _serviceBrand: undefined;
	registerConfig(config: IAgentConfiguration): void;
	getConfig(agentId: string): IAgentConfiguration | undefined;
	getAllConfigs(): IAgentConfiguration[];
}

export class AgentRegistryService extends Disposable implements IAgentRegistryService {
	declare readonly _serviceBrand: undefined;

	private readonly configs = new Map<string, IAgentConfiguration>();

	public registerConfig(config: IAgentConfiguration): void {
		this.configs.set(config.id, config);
	}

	public getConfig(agentId: string): IAgentConfiguration | undefined {
		return this.configs.get(agentId);
	}

	public getAllConfigs(): IAgentConfiguration[] {
		return Array.from(this.configs.values());
	}
}

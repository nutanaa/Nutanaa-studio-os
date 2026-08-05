/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IAgentTask, IAgentExecutionResult } from '../models/agentExecutionModel.js';
import { IAgentExecutionEngine } from './agentExecutionEngine.js';
import { IAgentStateService } from '../common/agentStateService.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';

export const IAgentDispatcher = createDecorator<IAgentDispatcher>('agentDispatcher');

export interface IAgentDispatcher {
	readonly _serviceBrand: undefined;

	dispatch(task: IAgentTask): Promise<IAgentExecutionResult>;
}

export class AgentDispatcher extends Disposable implements IAgentDispatcher {

	declare readonly _serviceBrand: undefined;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IAgentExecutionEngine private readonly executionEngine: IAgentExecutionEngine,
		@IAgentStateService private readonly stateService: IAgentStateService
	) {
		super();
	}

	public async dispatch(task: IAgentTask): Promise<IAgentExecutionResult> {

		this.stateService.updateAgentState(task.agentId, {
			status: 'running',
			progress: 0,
			lastHeartbeat: Date.now()
		});

		try {

			const result = await this.executionEngine.executeTask(
				task.agentId,
				task
			);

			this.stateService.updateAgentState(task.agentId, {
				status: 'idle',
				progress: 100,
				lastHeartbeat: Date.now(),
				totalCostUsd: result.totalCostUsd,
				totalTokensUsed: result.totalTokensUsed
			});

			return result;

		} catch (error) {

			this.stateService.updateAgentState(task.agentId, {
				status: 'error',
				lastHeartbeat: Date.now()
			});

			throw error;
		}
	}
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IAgentTask } from '../models/agentExecutionModel.js';

export const IAgentDispatcher = createDecorator<IAgentDispatcher>('agentDispatcher');

export interface IAgentDispatcher {
	readonly _serviceBrand: undefined;
	dispatch(task: IAgentTask): Promise<void>;
}

export class AgentDispatcher extends Disposable implements IAgentDispatcher {
	declare readonly _serviceBrand: undefined;

	public async dispatch(task: IAgentTask): Promise<void> {
		// Task dispatch handling logic
	}
}

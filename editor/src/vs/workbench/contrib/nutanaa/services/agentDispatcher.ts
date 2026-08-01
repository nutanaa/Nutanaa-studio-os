// File: src/vs/workbench/contrib/nutanaa/services/agentDispatcher.ts

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
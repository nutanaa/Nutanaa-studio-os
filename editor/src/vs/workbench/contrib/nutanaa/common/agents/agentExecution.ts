/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IAgentTask, IAgentExecutionResult, IAgentStepExecution } from '../../models/agentExecutionModel.js';

export class AgentExecutionTracker extends Disposable {
	private readonly activeExecutions = new Map<string, { task: IAgentTask; steps: IAgentStepExecution[]; startTime: number }>();

	public startExecution(executionId: string, task: IAgentTask): void {
		this.activeExecutions.set(executionId, {
			task,
			steps: [],
			startTime: Date.now()
		});
	}

	public addStep(executionId: string, step: IAgentStepExecution): void {
		const record = this.activeExecutions.get(executionId);
		if (record) {
			record.steps.push(step);
		}
	}

	public completeExecution(executionId: string, status: 'success' | 'failed' | 'cancelled', output: unknown, error?: string): IAgentExecutionResult | undefined {
		const record = this.activeExecutions.get(executionId);
		if (!record) {
			return undefined;
		}

		this.activeExecutions.delete(executionId);

		const totalCost = record.steps.reduce((sum, s) => sum + s.costUsd, 0);
		const totalTokens = record.steps.reduce((sum, s) => sum + s.tokensUsed, 0);

		return {
			executionId,
			agentId: record.task.agentId,
			taskId: record.task.id,
			status,
			steps: record.steps,
			durationMs: Date.now() - record.startTime,
			totalCostUsd: totalCost,
			totalTokensUsed: totalTokens,
			output,
			error
		};
	}
}

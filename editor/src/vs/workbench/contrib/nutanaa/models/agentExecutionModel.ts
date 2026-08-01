/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';

export interface IAgentTask {
	readonly id: string;
	readonly agentId: string;
	readonly title: string;
	readonly payload: Record<string, unknown>;
	readonly targetResource?: URI;
	readonly createdAt: number;
}

export interface IAgentStepExecution {
	readonly stepId: string;
	readonly taskTitle: string;
	readonly action: string;
	readonly input: unknown;
	readonly output?: unknown;
	readonly status: 'pending' | 'executing' | 'success' | 'failed';
	readonly startTime: number;
	readonly endTime?: number;
	readonly costUsd: number;
	readonly tokensUsed: number;
	readonly error?: string;
}

export interface IAgentExecutionResult {
	readonly executionId: string;
	readonly agentId: string;
	readonly taskId: string;
	readonly status: 'success' | 'failed' | 'cancelled';
	readonly steps: IAgentStepExecution[];
	readonly durationMs: number;
	readonly totalCostUsd: number;
	readonly totalTokensUsed: number;
	readonly output: unknown;
	readonly error?: string;
}

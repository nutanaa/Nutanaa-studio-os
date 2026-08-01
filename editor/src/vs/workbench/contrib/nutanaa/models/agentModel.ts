/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type AgentStatus = 'idle' | 'queued' | 'running' | 'paused' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled' | 'recovering';

export type AgentPriority = 'low' | 'normal' | 'high' | 'critical';

export interface IAgentPermissionRequest {
	readonly id: string;
	readonly agentId: string;
	readonly resource: string;
	readonly action: string;
	readonly reason: string;
	readonly timestamp: number;
	readonly status: 'pending' | 'approved' | 'rejected';
}

export interface IAgentConfiguration {
	readonly id: string;
	readonly name: string;
	readonly role: string;
	readonly maxConcurrency: number;
	readonly maxRetries: number;
	readonly timeoutMs: number;
	readonly maxBudgetUsd: number;
	readonly allowedTools: string[];
	readonly autoApproveLowRisk: boolean;
}

export interface IAgentState {
	readonly id: string;
	readonly config: IAgentConfiguration;
	readonly status: AgentStatus;
	readonly priority: AgentPriority;
	readonly currentTask?: string;
	readonly progress: number;
	readonly createdAt: number;
	readonly startedAt?: number;
	readonly completedAt?: number;
	readonly lastHeartbeat: number;
	readonly retryCount: number;
	readonly totalCostUsd: number;
	readonly totalTokensUsed: number;
	readonly error?: string;
}

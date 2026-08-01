/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IAgentHistoryEntry {
	readonly id: string;
	readonly agentId: string;
	readonly taskId: string;
	readonly taskTitle: string;
	readonly status: 'completed' | 'failed' | 'cancelled';
	readonly startTime: number;
	readonly endTime: number;
	readonly totalSteps: number;
	readonly costUsd: number;
	readonly tokensUsed: number;
	readonly logCount: number;
	readonly error?: string;
}

export interface IAgentCheckpointData {
	readonly checkpointId: string;
	readonly agentId: string;
	readonly timestamp: number;
	readonly stepIndex: number;
	readonly stateSnapshot: Record<string, unknown>;
	readonly memorySnapshot: unknown[];
}

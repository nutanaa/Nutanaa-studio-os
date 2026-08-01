// File: src/vs/workbench/contrib/nutanaa/models/agentQueueModel.ts

import { AgentPriority } from '../models/agentModel.js';
import { IAgentTask } from '../models/agentExecutionModel.js';

export interface IAgentQueueItem {
	readonly queueId: string;
	readonly task: IAgentTask;
	readonly priority: AgentPriority;
	readonly enqueuedAt: number;
	readonly retryAttempts: number;
	readonly maxRetries: number;
	readonly delayUntil?: number;
}

export interface IAgentQueueStatus {
	readonly pendingCount: number;
	readonly runningCount: number;
	readonly pausedCount: number;
	readonly items: IAgentQueueItem[];
}
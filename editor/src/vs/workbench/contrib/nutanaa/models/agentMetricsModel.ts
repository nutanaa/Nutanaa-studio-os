/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IAgentMetrics {
	readonly agentId: string;
	readonly activeTasks: number;
	readonly completedTasks: number;
	readonly failedTasks: number;
	readonly retriedTasks: number;
	readonly avgExecutionTimeMs: number;
	readonly totalTokensUsed: number;
	readonly totalCostUsd: number;
	readonly cpuUsagePercent: number;
	readonly memoryUsageMb: number;
	readonly uptimeMs: number;
	readonly timestamp: number;
}

export interface IAgentSystemHealth {
	readonly overallStatus: 'healthy' | 'degraded' | 'critical';
	readonly activeAgents: number;
	readonly queueLatencyMs: number;
	readonly failedAgentsCount: number;
	readonly totalCostTodayUsd: number;
	readonly issues: string[];
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IAgentMetrics } from '../models/agentMetricsModel.js';

export const IAgentMetricsService = createDecorator<IAgentMetricsService>('agentMetricsService');

export interface IAgentMetricsService {
	readonly _serviceBrand: undefined;
	recordMetrics(agentId: string, metrics: Partial<IAgentMetrics>): void;
	getMetrics(agentId: string): IAgentMetrics | undefined;
	getAllMetrics(): IAgentMetrics[];
}

export class AgentMetricsService extends Disposable implements IAgentMetricsService {
	declare readonly _serviceBrand: undefined;

	private readonly metricsMap = new Map<string, IAgentMetrics>();

	public recordMetrics(agentId: string, metrics: Partial<IAgentMetrics>): void {
		const existing = this.metricsMap.get(agentId) || {
			agentId,
			activeTasks: 0,
			completedTasks: 0,
			failedTasks: 0,
			retriedTasks: 0,
			avgExecutionTimeMs: 0,
			totalTokensUsed: 0,
			totalCostUsd: 0,
			cpuUsagePercent: 0,
			memoryUsageMb: 0,
			uptimeMs: 0,
			timestamp: Date.now()
		};

		const updated: IAgentMetrics = {
			...existing,
			...metrics,
			timestamp: Date.now()
		};
		this.metricsMap.set(agentId, updated);
	}

	public getMetrics(agentId: string): IAgentMetrics | undefined {
		return this.metricsMap.get(agentId);
	}

	public getAllMetrics(): IAgentMetrics[] {
		return Array.from(this.metricsMap.values());
	}
}

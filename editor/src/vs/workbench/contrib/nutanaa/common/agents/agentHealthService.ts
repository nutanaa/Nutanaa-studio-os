/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IAgentSystemHealth } from '../../models/agentMetricsModel.js';
import { IAgentStateService } from './agentStateService.js';

export const IAgentHealthService = createDecorator<IAgentHealthService>('agentHealthService');

export interface IAgentHealthService {
	readonly _serviceBrand: undefined;
	getSystemHealth(): IAgentSystemHealth;
}

export class AgentHealthService extends Disposable implements IAgentHealthService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IAgentStateService private readonly stateService: IAgentStateService
	) {
		super();
	}

	public getSystemHealth(): IAgentSystemHealth {
		const states = this.stateService.getAllAgentStates();
		const failedCount = states.filter(s => s.status === 'failed').length;
		const runningCount = states.filter(s => s.status === 'running').length;
		const issues: string[] = [];

		if (failedCount > 2) {
			issues.push(`High failure count detected: ${failedCount} agents failed`);
		}

		let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
		if (failedCount > 5) {
			overallStatus = 'critical';
		} else if (failedCount > 0) {
			overallStatus = 'degraded';
		}

		const totalCostToday = states.reduce((sum, s) => sum + s.totalCostUsd, 0);

		return {
			overallStatus,
			activeAgents: runningCount,
			queueLatencyMs: 45,
			failedAgentsCount: failedCount,
			totalCostTodayUsd: totalCostToday,
			issues
		};
	}
}

// File: src/vs/workbench/contrib/nutanaa/services/agentCoordinator.ts

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IAgentStateService } from '../common/agentStateService.js';
import { IAgentExecutionEngine } from '../services/agentExecutionEngine.js';
import { AgentQueue } from '../common/agentQueue.js';
import { IAgentTask } from '../models/agentExecutionModel.js';
import { AgentPriority } from '../models/agentModel.js';

export const IAgentCoordinator = createDecorator<IAgentCoordinator>('agentCoordinator');

export interface IAgentCoordinator {
	readonly _serviceBrand: undefined;
	submitTask(agentId: string, title: string, payload: Record<string, any>, priority?: AgentPriority): void;
	startScheduler(): void;
	stopScheduler(): void;
}

export class AgentCoordinator extends Disposable implements IAgentCoordinator {
	declare readonly _serviceBrand: undefined;

	private readonly queue = this._register(new AgentQueue());
	private loopTimer?: any;

	constructor(
		@IAgentStateService private readonly stateService: IAgentStateService,
		@IAgentExecutionEngine private readonly executionEngine: IAgentExecutionEngine
	) {
		super();
	}

	public submitTask(agentId: string, title: string, payload: Record<string, any>, priority: AgentPriority = 'normal'): void {
		const task: IAgentTask = {
			id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
			agentId,
			title,
			payload,
			createdAt: Date.now()
		};
		this.queue.enqueue(task, priority);
	}

	public startScheduler(): void {
		if (this.loopTimer) {
			return;
		}
		this.loopTimer = setInterval(() => this.processNext(), 1000);
	}

	public stopScheduler(): void {
		if (this.loopTimer) {
			clearInterval(this.loopTimer);
			this.loopTimer = undefined;
		}
	}

	private async processNext(): Promise<void> {
		const item = this.queue.dequeue();
		if (!item) {
			return;
		}

		const agentId = item.task.agentId;
		const state = this.stateService.getAgentState(agentId);
		if (!state) {
			this.queue.markFinished(item.queueId);
			return;
		}

		this.stateService.updateAgentState(agentId, { status: 'running', currentTask: item.task.title });

		try {
			await this.executionEngine.executeTask(agentId, item.task);
			this.stateService.updateAgentState(agentId, {
				status: 'completed',
				currentTask: undefined,
				progress: 100
			});
		} catch (err: any) {
			const requeued = this.queue.reenqueueForRetry(item);
			if (!requeued) {
				this.stateService.updateAgentState(agentId, {
					status: 'failed',
					error: err.message || 'Execution error'
				});
			}
		} finally {
			this.queue.markFinished(item.queueId);
		}
	}

	public override dispose(): void {
		this.stopScheduler();
		super.dispose();
	}
}
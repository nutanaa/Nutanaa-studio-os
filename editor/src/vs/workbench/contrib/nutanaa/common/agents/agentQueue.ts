/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { IAgentQueueItem, IAgentQueueStatus } from '../../models/agentQueueModel.js';
import { IAgentTask } from '../../models/agentExecutionModel.js';
import { AgentPriority } from '../../models/agentModel.js';

export class AgentQueue extends Disposable {
	private queue: IAgentQueueItem[] = [];
	private readonly runningSet = new Set<string>();
	private isPaused = false;

	private readonly _onQueueChanged = this._register(new Emitter<void>());
	readonly onQueueChanged: Event<void> = this._onQueueChanged.event;

	public enqueue(task: IAgentTask, priority: AgentPriority = 'normal', maxRetries: number = 3): IAgentQueueItem {
		const item: IAgentQueueItem = {
			queueId: `queue_${task.id}_${Date.now()}`,
			task,
			priority,
			enqueuedAt: Date.now(),
			retryAttempts: 0,
			maxRetries
		};
		this.queue.push(item);
		this.sortQueue();
		this._onQueueChanged.fire();
		return item;
	}

	public dequeue(): IAgentQueueItem | undefined {
		if (this.isPaused || this.queue.length === 0) {
			return undefined;
		}
		const now = Date.now();
		const eligibleIndex = this.queue.findIndex(item => !item.delayUntil || item.delayUntil <= now);
		if (eligibleIndex === -1) {
			return undefined;
		}
		const [item] = this.queue.splice(eligibleIndex, 1);
		this.runningSet.add(item.queueId);
		this._onQueueChanged.fire();
		return item;
	}

	public markFinished(queueId: string): void {
		this.runningSet.delete(queueId);
		this._onQueueChanged.fire();
	}

	public reenqueueForRetry(item: IAgentQueueItem, delayMs: number = 2000): boolean {
		this.runningSet.delete(item.queueId);
		if (item.retryAttempts >= item.maxRetries) {
			return false;
		}
		const updated: IAgentQueueItem = {
			...item,
			retryAttempts: item.retryAttempts + 1,
			delayUntil: Date.now() + delayMs
		};
		this.queue.push(updated);
		this.sortQueue();
		this._onQueueChanged.fire();
		return true;
	}

	public pause(): void {
		this.isPaused = true;
		this._onQueueChanged.fire();
	}

	public resume(): void {
		this.isPaused = false;
		this._onQueueChanged.fire();
	}

	public clear(): void {
		this.queue = [];
		this.runningSet.clear();
		this._onQueueChanged.fire();
	}

	public getStatus(): IAgentQueueStatus {
		return {
			pendingCount: this.queue.length,
			runningCount: this.runningSet.size,
			pausedCount: this.isPaused ? this.queue.length : 0,
			items: [...this.queue]
		};
	}

	private sortQueue(): void {
		const priorityMap: Record<AgentPriority, number> = {
			critical: 4,
			high: 3,
			normal: 2,
			low: 1
		};
		this.queue.sort((a, b) => {
			const pDiff = priorityMap[b.priority] - priorityMap[a.priority];
			if (pDiff !== 0) {
				return pDiff;
			}
			return a.enqueuedAt - b.enqueuedAt;
		});
	}
}

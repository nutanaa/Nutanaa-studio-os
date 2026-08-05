/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ILogService } from '../../../../platform/log/common/log.js';

import { ITaskScheduler, ISchedulerStatus } from '../common/taskScheduler.js';
import { IAgentCoordinator } from '../common/agentCoordinator.js';
import { IRuntimeEventBus } from '../common/runtimeEventBus.js';
import { IRuntimeStateService } from '../common/runtimeState.js';
import { RuntimeEventType } from '../common/runtimeEvent.js';

import {
	ITaskDefinition,
	ITaskResult,
	IScheduledTask,
	IAgentExecutionResponse,
} from '../models/executionModel.js';
import { AgentPriority } from '../models/agentModel.js';

/*---------------------------------------------------------------------------------------------
 * Constants
 *--------------------------------------------------------------------------------------------*/

const DEFAULT_MAX_CONCURRENCY = 4;
const DEFAULT_RETRY_BASE_DELAY_MS = 1000;
const DRAIN_INTERVAL_MS = 100;

/*---------------------------------------------------------------------------------------------
 * TaskScheduler
 *--------------------------------------------------------------------------------------------*/

/**
 * TaskScheduler — FIFO+priority queue with configurable concurrency.
 *
 * Architecture:
 *   ITaskScheduler.submit()
 *     ↓
 *   pendingQueue (sorted by priority + enqueuedAt)
 *     ↓ (drain loop every 100 ms)
 *   IAgentCoordinator.executeAgent()
 *     ↓
 *   IRuntimeEventBus (TaskQueued / TaskStarted / TaskCompleted / TaskFailed / TaskCancelled)
 *     ↓
 *   IRuntimeStateService.updateTasks()
 */
export class TaskScheduler extends Disposable implements ITaskScheduler {

	declare readonly _serviceBrand: undefined;

	/*-------------------------------------------------------------------------------------------
	 * Internal state
	 *------------------------------------------------------------------------------------------*/

	/** Tasks waiting to be dispatched. Always kept priority-sorted. */
	private readonly pendingQueue: IScheduledTask[] = [];

	/** Tasks that are currently running. */
	private readonly runningMap = new Map<string, IScheduledTask>();

	/** Terminal records (completed / failed / cancelled). */
	private readonly terminalMap = new Map<string, ITaskResult>();

	private _maxConcurrency = DEFAULT_MAX_CONCURRENCY;
	private _isPaused = false;

	/** Drain timer handle. */
	private drainTimer: ReturnType<typeof setInterval> | undefined;

	/*-------------------------------------------------------------------------------------------
	 * Events
	 *------------------------------------------------------------------------------------------*/

	private readonly _onTaskStateChanged = this._register(new Emitter<ITaskResult>());
	public readonly onTaskStateChanged: Event<ITaskResult> = this._onTaskStateChanged.event;

	private readonly _onStatusChanged = this._register(new Emitter<ISchedulerStatus>());
	public readonly onStatusChanged: Event<ISchedulerStatus> = this._onStatusChanged.event;

	/*-------------------------------------------------------------------------------------------
	 * Constructor
	 *------------------------------------------------------------------------------------------*/

	constructor(
		@IAgentCoordinator private readonly agentCoordinator: IAgentCoordinator,
		@IRuntimeEventBus private readonly eventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly stateService: IRuntimeStateService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.startDrainLoop();
	}

	/*-------------------------------------------------------------------------------------------
	 * ITaskScheduler — submission
	 *------------------------------------------------------------------------------------------*/

	public submit(definition: ITaskDefinition): Promise<ITaskResult> {
		return new Promise<ITaskResult>((resolve, reject) => {
			const scheduled: IScheduledTask = {
				taskId: definition.taskId,
				definition,
				state: 'pending',
				enqueuedAt: Date.now(),
				startedAt: undefined,
				completedAt: undefined,
				retryCount: 0,
				resolve,
				reject,
			};

			this.insertByPriority(scheduled);
			this.publishTaskEvent(RuntimeEventType.TaskQueued, definition.taskId, definition.request.title, 'queued');
			this.publishStatusChanged();
		});
	}

	/*-------------------------------------------------------------------------------------------
	 * ITaskScheduler — control
	 *------------------------------------------------------------------------------------------*/

	public cancel(taskId: string): void {
		// Remove from pending.
		const pendingIdx = this.pendingQueue.findIndex(t => t.taskId === taskId);
		if (pendingIdx !== -1) {
			const [task] = this.pendingQueue.splice(pendingIdx, 1);
			this.settle(task, 'cancelled', undefined, 'Cancelled before execution.');
			return;
		}

		// Abort running — tell the coordinator.
		const running = this.runningMap.get(taskId);
		if (running) {
			running.state = 'cancelled';
			void this.agentCoordinator.cancelAgent(running.definition.request.agentId);
		}
	}

	public retry(taskId: string): void {
		const terminal = this.terminalMap.get(taskId);
		if (!terminal || terminal.status !== 'failed') {
			return;
		}
		this.terminalMap.delete(taskId);

		return void this.submit({
			...terminal.response?.metadata
				? this.findOriginalDefinition(taskId) ?? this.buildRetryDefinition(terminal)
				: this.buildRetryDefinition(terminal),
		});
	}

	public pause(): void {
		if (this._isPaused) {
			return;
		}
		this._isPaused = true;
		this.logService.info('[TaskScheduler] paused.');
		this.publishStatusChanged();
	}

	public resume(): void {
		if (!this._isPaused) {
			return;
		}
		this._isPaused = false;
		this.logService.info('[TaskScheduler] resumed.');
		this.publishStatusChanged();
	}

	public setMaxConcurrency(n: number): void {
		this._maxConcurrency = Math.max(1, n);
		this.logService.info(`[TaskScheduler] maxConcurrency set to ${this._maxConcurrency}.`);
		this.publishStatusChanged();
	}

	/*-------------------------------------------------------------------------------------------
	 * ITaskScheduler — queries
	 *------------------------------------------------------------------------------------------*/

	public getStatus(): ISchedulerStatus {
		return {
			pendingCount: this.pendingQueue.length,
			runningCount: this.runningMap.size,
			completedCount: [...this.terminalMap.values()].filter(t => t.status === 'completed').length,
			failedCount: [...this.terminalMap.values()].filter(t => t.status === 'failed').length,
			cancelledCount: [...this.terminalMap.values()].filter(t => t.status === 'cancelled').length,
			isPaused: this._isPaused,
			maxConcurrency: this._maxConcurrency,
		};
	}

	public getTask(taskId: string): ITaskResult | undefined {
		return this.terminalMap.get(taskId);
	}

	/*-------------------------------------------------------------------------------------------
	 * Drain loop
	 *------------------------------------------------------------------------------------------*/

	private startDrainLoop(): void {
		this.drainTimer = setInterval(() => this.drain(), DRAIN_INTERVAL_MS);
	}

	private drain(): void {
		if (this._isPaused) {
			return;
		}

		while (
			this.runningMap.size < this._maxConcurrency &&
			this.pendingQueue.length > 0
		) {
			const next = this.peekEligible();
			if (!next) {
				break;
			}
			this.pendingQueue.splice(this.pendingQueue.indexOf(next), 1);
			void this.dispatch(next);
		}
	}

	/**
	 * Returns the highest-priority task that is eligible right now
	 * (notBefore satisfied, dependencies completed).
	 */
	private peekEligible(): IScheduledTask | undefined {
		const now = Date.now();
		return this.pendingQueue.find(task => {
			// Delay gate.
			if (task.definition.notBefore !== undefined && task.definition.notBefore > now) {
				return false;
			}
			// Dependency gate — all must be in terminalMap with status 'completed'.
			for (const depId of task.definition.dependsOn) {
				const dep = this.terminalMap.get(depId);
				if (!dep || dep.status !== 'completed') {
					return false;
				}
			}
			return true;
		});
	}

	/*-------------------------------------------------------------------------------------------
	 * Dispatch
	 *------------------------------------------------------------------------------------------*/

	private async dispatch(task: IScheduledTask): Promise<void> {
		task.state = 'running';
		task.startedAt = Date.now();
		this.runningMap.set(task.taskId, task);

		this.publishTaskEvent(
			RuntimeEventType.TaskStarted,
			task.taskId,
			task.definition.request.title,
			'running',
		);
		this.publishStatusChanged();

		// Apply wall-clock timeout.
		const timeoutMs = task.definition.timeoutMs || task.definition.request.timeoutMs;

		try {
			const responsePromise = this.agentCoordinator.executeAgent(task.definition.request);

			const response = timeoutMs > 0
				? await Promise.race([responsePromise, this.buildTimeoutPromise(timeoutMs)])
				: await responsePromise;

			this.runningMap.delete(task.taskId);

			if (response === null) {
				// Timeout sentinel.
				this.settle(task, 'timeout', undefined, `Task timed out after ${timeoutMs}ms.`);
				return;
			}

			if (response.status === 'success') {
				this.settle(task, 'completed', response, undefined);
			} else if (response.status === 'cancelled') {
				this.settle(task, 'cancelled', response, undefined);
			} else {
				this.maybeRetry(task, response.error ?? 'Execution failed.');
			}

		} catch (err) {
			this.runningMap.delete(task.taskId);
			const msg = err instanceof Error ? err.message : String(err);
			this.maybeRetry(task, msg);
		}
	}

	private buildTimeoutPromise(ms: number): Promise<null> {
		return new Promise(resolve => setTimeout(() => resolve(null), ms));
	}

	/*-------------------------------------------------------------------------------------------
	 * Retry
	 *------------------------------------------------------------------------------------------*/

	private maybeRetry(task: IScheduledTask, errorMsg: string): void {
		const maxRetries = task.definition.maxRetries;
		if (task.retryCount < maxRetries) {
			task.retryCount++;
			task.state = 'pending';

			const delayMs = DEFAULT_RETRY_BASE_DELAY_MS * Math.pow(2, task.retryCount - 1);
			const retryTask: IScheduledTask = {
				...task,
				definition: {
					...task.definition,
					notBefore: Date.now() + delayMs,
				},
			};

			this.logService.info(
				`[TaskScheduler] task ${task.taskId} will retry (${task.retryCount}/${maxRetries}) in ${delayMs}ms.`
			);
			this.insertByPriority(retryTask);
			this.publishStatusChanged();
		} else {
			this.settle(task, 'failed', undefined, errorMsg);
		}
	}

	/*-------------------------------------------------------------------------------------------
	 * Settlement
	 *------------------------------------------------------------------------------------------*/

	private settle(
		task: IScheduledTask,
		status: ITaskResult['status'],
		response: IAgentExecutionResponse | undefined,
		errorMsg: string | undefined,
	): void {
		const now = Date.now();
		task.state = status === 'completed' ? 'completed' : status === 'cancelled' ? 'cancelled' : 'failed';
		task.completedAt = now;

		const result: ITaskResult = {
			taskId: task.taskId,
			status,
			response,
			error: errorMsg,
			enqueuedAt: task.enqueuedAt,
			startedAt: task.startedAt,
			completedAt: now,
			retryCount: task.retryCount,
		};

		this.terminalMap.set(task.taskId, result);

		const eventType = status === 'completed'
			? RuntimeEventType.TaskCompleted
			: status === 'cancelled'
				? RuntimeEventType.TaskCancelled
				: RuntimeEventType.TaskFailed;

		this.publishTaskEvent(
			eventType,
			task.taskId,
			task.definition.request.title,
			status,
		);

		this._onTaskStateChanged.fire(result);
		this.publishStatusChanged();

		task.resolve(result);
	}

	/*-------------------------------------------------------------------------------------------
	 * Event publishing
	 *------------------------------------------------------------------------------------------*/

	private publishTaskEvent(
		type: RuntimeEventType,
		taskId: string,
		title: string,
		state: string,
	): void {
		this.eventBus.fire({
			type,
			timestamp: Date.now(),
			payload: { id: taskId, title, state },
		});

		this.stateService.updateTasks({
			[taskId]: {
				id: taskId,
				title,
				agentId: this.runningMap.get(taskId)?.definition.request.agentId ?? '',
				state: this.toRuntimeTaskState(state),
				createdAt: this.runningMap.get(taskId)?.enqueuedAt ?? Date.now(),
				startedAt: this.runningMap.get(taskId)?.startedAt,
				completedAt: this.terminalMap.get(taskId)?.completedAt,
				errorMessage: this.terminalMap.get(taskId)?.error,
			},
		});
	}

	private publishStatusChanged(): void {
		this._onStatusChanged.fire(this.getStatus());
	}

	/*-------------------------------------------------------------------------------------------
	 * Helpers
	 *------------------------------------------------------------------------------------------*/

	private insertByPriority(task: IScheduledTask): void {
		const weight = this.priorityWeight(task.definition.request.priority);
		const idx = this.pendingQueue.findIndex(
			t => this.priorityWeight(t.definition.request.priority) < weight
		);
		if (idx === -1) {
			this.pendingQueue.push(task);
		} else {
			this.pendingQueue.splice(idx, 0, task);
		}
	}

	private priorityWeight(p: AgentPriority): number {
		switch (p) {
			case 'critical': return 4;
			case 'high':     return 3;
			case 'normal':   return 2;
			case 'low':      return 1;
		}
	}

	/** Look up the original ITaskDefinition from the pending or terminal map. */
	private findOriginalDefinition(taskId: string): ITaskDefinition | undefined {
		return this.pendingQueue.find(t => t.taskId === taskId)?.definition;
	}

	private buildRetryDefinition(terminal: ITaskResult): ITaskDefinition {
		// Reconstruct minimal definition from the stored result for a manual retry.
		return {
			taskId: `${terminal.taskId}_retry_${Date.now()}`,
			request: {
				requestId: `req_retry_${terminal.taskId}_${Date.now()}`,
				agentId: terminal.response?.agentId ?? '',
				title: `Retry: ${terminal.taskId}`,
				payload: {},
				priority: 'normal',
				timeoutMs: 0,
				maxRetries: 0,
				workflowId: undefined,
				workflowNodeId: undefined,
			},
			dependsOn: [],
			notBefore: undefined,
			maxRetries: 0,
			timeoutMs: 0,
			background: false,
		};
	}

	private toRuntimeTaskState(
		state: string
	): 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' {
		switch (state) {
			case 'queued':    return 'queued';
			case 'running':   return 'running';
			case 'completed': return 'completed';
			case 'cancelled': return 'cancelled';
			// 'timeout' and 'failed' both map to 'failed' in the state layer.
			default:          return 'failed';
		}
	}

	/*-------------------------------------------------------------------------------------------
	 * Dispose
	 *------------------------------------------------------------------------------------------*/

	public override dispose(): void {
		if (this.drainTimer !== undefined) {
			clearInterval(this.drainTimer);
			this.drainTimer = undefined;
		}
		super.dispose();
	}
}

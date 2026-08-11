/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../../base/common/event.js';
import { ITaskDefinition, ITaskResult } from '../../models/executionModel.js';

/*---------------------------------------------------------------------------------------------
 * Queue status snapshot (read-only, exposed to views via IRuntimeStateService)
 *--------------------------------------------------------------------------------------------*/

export interface ISchedulerStatus {
	readonly pendingCount: number;
	readonly runningCount: number;
	readonly completedCount: number;
	readonly failedCount: number;
	readonly cancelledCount: number;
	readonly isPaused: boolean;
	readonly maxConcurrency: number;
}

/*---------------------------------------------------------------------------------------------
 * DI token
 *--------------------------------------------------------------------------------------------*/

export const ITaskScheduler = createDecorator<ITaskScheduler>('taskScheduler');

/*---------------------------------------------------------------------------------------------
 * Interface
 *--------------------------------------------------------------------------------------------*/

/**
 * ITaskScheduler — priority queue with configurable concurrency.
 *
 * Responsibilities:
 *  • Accept ITaskDefinition items, honouring priority and notBefore delays.
 *  • Respect dependency chains (dependsOn).
 *  • Enforce configurable concurrency (maxConcurrency parallel slots).
 *  • Support pause / resume / cancel for individual tasks or all tasks.
 *  • Retry tasks on transient failure with exponential back-off.
 *  • Apply per-task wall-clock timeouts.
 *  • Publish every state transition onto IRuntimeEventBus and into
 *    IRuntimeStateService.
 *
 * Consumers (WorkflowEngine, AgentCoordinator) submit a task and await the
 * returned Promise<ITaskResult>. The scheduler resolves or rejects it once
 * the task reaches a terminal state.
 */
export interface ITaskScheduler {

	readonly _serviceBrand: undefined;

	// ── Events ────────────────────────────────────────────────────────────

	/** Fires whenever a task changes state (queued → running → completed/failed/cancelled). */
	readonly onTaskStateChanged: Event<ITaskResult>;

	/** Fires whenever the scheduler's overall status changes (pause/resume/concurrency). */
	readonly onStatusChanged: Event<ISchedulerStatus>;

	// ── Submission ────────────────────────────────────────────────────────

	/**
	 * Enqueue a task. Returns a Promise that resolves when the task reaches
	 * a terminal state (completed, failed, cancelled, or timeout).
	 */
	submit(definition: ITaskDefinition): Promise<ITaskResult>;

	// ── Control ───────────────────────────────────────────────────────────

	/**
	 * Cancel a specific task. If it is running the execution is aborted.
	 * If it is pending it is removed from the queue.
	 */
	cancel(taskId: string): void;

	/**
	 * Retry a task that is in state 'failed'. Re-queues it with its original
	 * definition, resetting retryCount to 0.
	 */
	retry(taskId: string): void;

	/**
	 * Pause the scheduler. Running tasks complete normally; no new tasks are
	 * dequeued until resume() is called.
	 */
	pause(): void;

	/**
	 * Resume dispatching after pause().
	 */
	resume(): void;

	// ── Configuration ─────────────────────────────────────────────────────

	/**
	 * Change the maximum number of tasks that may run concurrently.
	 * Takes effect on the next dispatch cycle.
	 */
	setMaxConcurrency(n: number): void;

	// ── Queries ───────────────────────────────────────────────────────────

	getStatus(): ISchedulerStatus;

	getTask(taskId: string): ITaskResult | undefined;
}

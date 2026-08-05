/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';

import { IAgentExecutionRequest, IAgentExecutionResponse } from '../models/executionModel.js';
import { AgentPriority } from '../models/agentModel.js';

/*---------------------------------------------------------------------------------------------
 * Agent lifecycle state (editor-side view of an agent slot)
 *--------------------------------------------------------------------------------------------*/

export type AgentLifecycleState =
	| 'idle'
	| 'queued'
	| 'running'
	| 'completed'
	| 'failed'
	| 'cancelled';

export interface IAgentSlot {
	readonly agentId: string;
	readonly name: string;
	readonly provider: string;
	/** Current lifecycle state. */
	readonly state: AgentLifecycleState;
	/** Id of the execution currently running, if any. */
	readonly activeExecutionId: string | undefined;
}

/*---------------------------------------------------------------------------------------------
 * DI token
 *--------------------------------------------------------------------------------------------*/

export const IAgentCoordinator = createDecorator<IAgentCoordinator>('agentCoordinator');

/*---------------------------------------------------------------------------------------------
 * Interface
 *--------------------------------------------------------------------------------------------*/

export interface IAgentCoordinator {

	readonly _serviceBrand: undefined;

	/**
	 * Wire the dispatch function post-construction.
	 * Called once by RuntimeCoordinator.start() to break the
	 * AgentCoordinator → IAgentDispatcher → IAgentCoordinator circular dep.
	 */
	setDispatcher(
		fn: (req: IAgentExecutionRequest) => Promise<IAgentExecutionResponse>
	): void;

	/**
	 * Fires whenever the set of agent slots or any slot's state changes.
	 */
	readonly onAgentSlotsChanged: Event<readonly IAgentSlot[]>;

	/**
	 * Fires when an individual slot transitions state.
	 */
	readonly onAgentStateChanged: Event<IAgentSlot>;

	// ── Slot management ───────────────────────────────────────────────────

	/**
	 * Register an agent slot. Must be called before the agent can execute.
	 */
	registerAgent(agentId: string, name: string, provider: string): void;

	/**
	 * Unregister an agent slot. Cancels any active execution first.
	 */
	unregisterAgent(agentId: string): Promise<void>;

	// ── Execution ─────────────────────────────────────────────────────────

	/**
	 * Place an execution request in the coordinator's internal queue.
	 * The coordinator owns prioritisation and dispatching.
	 */
	queueAgent(
		agentId: string,
		title: string,
		payload: Readonly<Record<string, unknown>>,
		priority?: AgentPriority,
		timeoutMs?: number,
		maxRetries?: number,
	): string; // returns requestId

	/**
	 * Execute immediately, bypassing the internal queue.
	 * Used by WorkflowEngine to drive individual workflow nodes.
	 */
	executeAgent(request: IAgentExecutionRequest): Promise<IAgentExecutionResponse>;

	/**
	 * Cancel the active or queued execution for the given agent.
	 * Resolves once the cancellation is acknowledged.
	 */
	cancelAgent(agentId: string): Promise<void>;

	/**
	 * Cancel any active execution and re-queue the agent from scratch.
	 */
	restartAgent(agentId: string): Promise<void>;

	// ── Queries ───────────────────────────────────────────────────────────

	getRunningAgents(): readonly IAgentSlot[];

	getQueuedAgents(): readonly IAgentSlot[];

	getCompletedAgents(): readonly IAgentSlot[];

	getAgent(agentId: string): IAgentSlot | undefined;

	getAllAgents(): readonly IAgentSlot[];
}

/*---------------------------------------------------------------------------------------------
 * Implementation
 *--------------------------------------------------------------------------------------------*/

/**
 * AgentCoordinator owns the lifecycle of every registered agent slot.
 *
 * It does NOT contain execution logic — it delegates to IAgentDispatcher
 * (injected lazily via a factory to break the circular:
 *   AgentCoordinator → IAgentDispatcher → IAgentCoordinator).
 *
 * Execution flow:
 *   queueAgent()  → enqueues request, transitions slot to 'queued'
 *   _drainQueue() → picks next pending request, calls executeAgent()
 *   executeAgent() → delegates to IAgentDispatcher.dispatch()
 *                 → transitions slot idle → running → completed/failed
 */
export class AgentCoordinator extends Disposable implements IAgentCoordinator {

	declare readonly _serviceBrand: undefined;

	/*-------------------------------------------------------------------------------------------
	 * Internal state
	 *------------------------------------------------------------------------------------------*/

	private readonly slots = new Map<string, IAgentSlot>();

	/** Queued requests waiting for dispatch. Priority order is maintained on insert. */
	private readonly pendingQueue: IAgentExecutionRequest[] = [];

	/** In-flight executionIds → AbortController for cancellation. */
	private readonly cancellationMap = new Map<string, AbortController>();

	/** Lazy reference to IAgentDispatcher — set by setDispatcher() to avoid circular DI. */
	private dispatchFn: ((req: IAgentExecutionRequest) => Promise<IAgentExecutionResponse>) | undefined;

	/*-------------------------------------------------------------------------------------------
	 * Events
	 *------------------------------------------------------------------------------------------*/

	private readonly _onAgentSlotsChanged = this._register(new Emitter<readonly IAgentSlot[]>());
	public readonly onAgentSlotsChanged: Event<readonly IAgentSlot[]> = this._onAgentSlotsChanged.event;

	private readonly _onAgentStateChanged = this._register(new Emitter<IAgentSlot>());
	public readonly onAgentStateChanged: Event<IAgentSlot> = this._onAgentStateChanged.event;

	/*-------------------------------------------------------------------------------------------
	 * Dispatcher injection (breaks circular dep — called by contribution bootstrap)
	 *------------------------------------------------------------------------------------------*/

	/**
	 * Provide the dispatch function. Must be called once during bootstrap,
	 * after both AgentCoordinator and AgentDispatcher have been constructed.
	 */
	public setDispatcher(
		fn: (req: IAgentExecutionRequest) => Promise<IAgentExecutionResponse>
	): void {
		this.dispatchFn = fn;
	}

	/*-------------------------------------------------------------------------------------------
	 * IAgentCoordinator — slot management
	 *------------------------------------------------------------------------------------------*/

	public registerAgent(agentId: string, name: string, provider: string): void {
		if (this.slots.has(agentId)) {
			return;
		}
		const slot: IAgentSlot = {
			agentId,
			name,
			provider,
			state: 'idle',
			activeExecutionId: undefined,
		};
		this.slots.set(agentId, slot);
		this.publishSlotsChanged();
	}

	public async unregisterAgent(agentId: string): Promise<void> {
		await this.cancelAgent(agentId);
		this.slots.delete(agentId);
		// Remove any pending requests for this agent.
		const before = this.pendingQueue.length;
		for (let i = this.pendingQueue.length - 1; i >= 0; i--) {
			if (this.pendingQueue[i].agentId === agentId) {
				this.pendingQueue.splice(i, 1);
			}
		}
		if (this.slots.size !== this.slots.size || before !== this.pendingQueue.length) {
			this.publishSlotsChanged();
		}
	}

	/*-------------------------------------------------------------------------------------------
	 * IAgentCoordinator — execution
	 *------------------------------------------------------------------------------------------*/

	public queueAgent(
		agentId: string,
		title: string,
		payload: Readonly<Record<string, unknown>>,
		priority: AgentPriority = 'normal',
		timeoutMs: number = 0,
		maxRetries: number = 2,
	): string {
		const requestId = `req_${agentId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

		const request: IAgentExecutionRequest = {
			requestId,
			agentId,
			title,
			payload,
			priority,
			timeoutMs,
			maxRetries,
			workflowId: undefined,
			workflowNodeId: undefined,
		};

		this.insertByPriority(request);
		this.transitionSlot(agentId, 'queued', undefined);

		// Best-effort drain — the dispatcher may not be wired yet during tests.
		void this.drainQueue();

		return requestId;
	}

	public async executeAgent(request: IAgentExecutionRequest): Promise<IAgentExecutionResponse> {
		if (!this.dispatchFn) {
			throw new Error('[AgentCoordinator] Dispatcher not wired — call setDispatcher() during bootstrap.');
		}

		this.transitionSlot(request.agentId, 'running', request.requestId);

		const ac = new AbortController();
		this.cancellationMap.set(request.requestId, ac);

		try {
			const response = await this.dispatchFn(request);
			this.cancellationMap.delete(request.requestId);
			const nextState: AgentLifecycleState =
				response.status === 'success' ? 'completed' : 'failed';
			this.transitionSlot(request.agentId, nextState, undefined);
			return response;
		} catch (err) {
			this.cancellationMap.delete(request.requestId);
			this.transitionSlot(request.agentId, 'failed', undefined);
			throw err;
		}
	}

	public async cancelAgent(agentId: string): Promise<void> {
		const slot = this.slots.get(agentId);
		if (!slot) {
			return;
		}

		// Abort in-flight execution.
		if (slot.activeExecutionId) {
			this.cancellationMap.get(slot.activeExecutionId)?.abort();
			this.cancellationMap.delete(slot.activeExecutionId);
		}

		// Remove all pending requests for this agent.
		for (let i = this.pendingQueue.length - 1; i >= 0; i--) {
			if (this.pendingQueue[i].agentId === agentId) {
				this.pendingQueue.splice(i, 1);
			}
		}

		this.transitionSlot(agentId, 'cancelled', undefined);
	}

	public async restartAgent(agentId: string): Promise<void> {
		const slot = this.slots.get(agentId);
		if (!slot) {
			return;
		}

		// Store the last queued request before cancelling.
		const lastRequest = this.pendingQueue.find(r => r.agentId === agentId);

		await this.cancelAgent(agentId);

		// Re-queue if we had a pending request.
		if (lastRequest) {
			this.insertByPriority(lastRequest);
			this.transitionSlot(agentId, 'queued', undefined);
			void this.drainQueue();
		} else {
			this.transitionSlot(agentId, 'idle', undefined);
		}
	}

	/*-------------------------------------------------------------------------------------------
	 * IAgentCoordinator — queries
	 *------------------------------------------------------------------------------------------*/

	public getRunningAgents(): readonly IAgentSlot[] {
		return this.filterByState('running');
	}

	public getQueuedAgents(): readonly IAgentSlot[] {
		return this.filterByState('queued');
	}

	public getCompletedAgents(): readonly IAgentSlot[] {
		return this.filterByState('completed');
	}

	public getAgent(agentId: string): IAgentSlot | undefined {
		return this.slots.get(agentId);
	}

	public getAllAgents(): readonly IAgentSlot[] {
		return [...this.slots.values()];
	}

	/*-------------------------------------------------------------------------------------------
	 * Private helpers
	 *------------------------------------------------------------------------------------------*/

	private async drainQueue(): Promise<void> {
		if (!this.dispatchFn) {
			return;
		}

		const next = this.pendingQueue.shift();
		if (!next) {
			return;
		}

		// Fire-and-forget; executeAgent handles state transitions.
		void this.executeAgent(next);
	}

	private insertByPriority(request: IAgentExecutionRequest): void {
		const weight = this.priorityWeight(request.priority);
		const idx = this.pendingQueue.findIndex(
			r => this.priorityWeight(r.priority) < weight
		);
		if (idx === -1) {
			this.pendingQueue.push(request);
		} else {
			this.pendingQueue.splice(idx, 0, request);
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

	private transitionSlot(
		agentId: string,
		state: AgentLifecycleState,
		activeExecutionId: string | undefined,
	): void {
		const current = this.slots.get(agentId);
		if (!current) {
			return;
		}
		const updated: IAgentSlot = { ...current, state, activeExecutionId };
		this.slots.set(agentId, updated);
		this._onAgentStateChanged.fire(updated);
		this.publishSlotsChanged();
	}

	private filterByState(state: AgentLifecycleState): readonly IAgentSlot[] {
		return [...this.slots.values()].filter(s => s.state === state);
	}

	private publishSlotsChanged(): void {
		this._onAgentSlotsChanged.fire([...this.slots.values()]);
	}
}

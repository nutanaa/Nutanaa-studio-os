/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../../platform/log/common/log.js';

import { IRuntimeEventBus } from '../../common/runtime/runtimeEventBus.js';
import { IRuntimeStateService } from '../../common/runtime/runtimeState.js';
import { RuntimeEventType } from '../../common/runtime/runtimeEvent.js';
import { INutanaaRuntimeConnectionService } from '../../common/nutanaa.js';

import {
	IAgentExecutionRequest,
	IAgentExecutionResponse,
	IExecutionContext,
	IExecutionMetadata,
} from '../../models/executionModel.js';

/*---------------------------------------------------------------------------------------------
 * DI token
 *--------------------------------------------------------------------------------------------*/

export const IAgentDispatcher = createDecorator<IAgentDispatcher>('agentDispatcher');

/*---------------------------------------------------------------------------------------------
 * Interface
 *--------------------------------------------------------------------------------------------*/

/**
 * IAgentDispatcher — the bridge between the coordinator layer and the
 * provider execution layer.
 *
 * Responsibilities:
 *   1. Build an IExecutionContext from the incoming IAgentExecutionRequest.
 *   2. Publish AgentStarted onto IRuntimeEventBus.
 *   3. Update IRuntimeStateService (agent running, task running).
 *   4. Invoke the actual execution backend (AgentExecutionEngine or provider).
 *   5. Publish AgentCompleted / AgentFailed onto IRuntimeEventBus.
 *   6. Update IRuntimeStateService with final status and metrics.
 *   7. Return IAgentExecutionResponse.
 */
export interface IAgentDispatcher {
	readonly _serviceBrand: undefined;

	/**
	 * Dispatch a single agent execution request.
	 * Always resolves (never rejects); failures are reported via
	 * response.status === 'failed' and response.error.
	 */
	dispatch(request: IAgentExecutionRequest): Promise<IAgentExecutionResponse>;
}

/*---------------------------------------------------------------------------------------------
 * Implementation
 *--------------------------------------------------------------------------------------------*/

/**
 * AgentDispatcher — production implementation of IAgentDispatcher.
 *
 * Does NOT contain model inference logic. That belongs to the provider
 * layer (Phase 3). For now the dispatcher builds the execution context,
 * publishes lifecycle events, and invokes AgentExecutionEngine.
 *
 * Phase 3 will replace the direct AgentExecutionEngine call with a
 * ProviderManager.select() → provider.execute() pipeline.
 */
export class AgentDispatcher extends Disposable implements IAgentDispatcher {

	declare readonly _serviceBrand: undefined;

	/** In-flight execution contexts, keyed by executionId. */
	private readonly inFlight = new Map<string, IExecutionContext>();

	constructor(
		@IRuntimeEventBus private readonly eventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly stateService: IRuntimeStateService,
		@ILogService private readonly logService: ILogService,
		@INutanaaRuntimeConnectionService private readonly connectionService: INutanaaRuntimeConnectionService,
	) {
		super();
	}

	/*-------------------------------------------------------------------------------------------
	 * IAgentDispatcher
	 *------------------------------------------------------------------------------------------*/

	public async dispatch(request: IAgentExecutionRequest): Promise<IAgentExecutionResponse> {
		const executionId = `exec_${request.requestId}_${Date.now()}`;
		const startedAt = Date.now();

		const ctx: IExecutionContext = {
			executionId,
			agentId: request.agentId,
			workflowId: request.workflowId,
			workflowNodeId: request.workflowNodeId,
			createdAt: startedAt,
			timeoutMs: request.timeoutMs,
			vars: request.payload,
		};

		this.inFlight.set(executionId, ctx);

		// ── Publish AgentStarted ──────────────────────────────────────────
		this.fireAgentEvent(RuntimeEventType.AgentStarted, request.agentId, request.title, 'running');
		this.updateAgentState(request.agentId, 'running');
		this.updateTaskState(
			request.requestId, request.title, request.agentId, 'running', startedAt, undefined
		);

		this.logService.info(
			`[AgentDispatcher] dispatching execution ${executionId} for agent ${request.agentId} — "${request.title}"`
		);

		try {
			// ── Execute ───────────────────────────────────────────────────
			const output = await this.runExecution(ctx, request);

			const completedAt = Date.now();
			this.inFlight.delete(executionId);

			const metadata = this.buildMetadata(ctx, completedAt);

			// ── Publish AgentCompleted ────────────────────────────────────
			this.fireAgentEvent(RuntimeEventType.AgentCompleted, request.agentId, request.title, 'completed');
			this.updateAgentState(request.agentId, 'completed');
			this.updateTaskState(
				request.requestId, request.title, request.agentId, 'completed', startedAt, completedAt
			);
			this.updateAgentMetrics(request.agentId, metadata);

			this.logService.info(
				`[AgentDispatcher] execution ${executionId} completed in ${metadata.durationMs}ms.`
			);

			return {
				requestId: request.requestId,
				executionId,
				agentId: request.agentId,
				status: 'success',
				output,
				metadata,
				error: undefined,
			};

		} catch (err) {
			const completedAt = Date.now();
			this.inFlight.delete(executionId);

			const errorMsg = err instanceof Error ? err.message : String(err);
			const metadata = this.buildMetadata(ctx, completedAt);

			// ── Publish AgentFailed ───────────────────────────────────────
			this.fireAgentEvent(RuntimeEventType.AgentFailed, request.agentId, request.title, 'failed');
			this.updateAgentState(request.agentId, 'failed');
			this.updateTaskState(
				request.requestId, request.title, request.agentId, 'failed', startedAt, completedAt, errorMsg
			);

			this.logService.error(
				`[AgentDispatcher] execution ${executionId} failed: ${errorMsg}`
			);

			return {
				requestId: request.requestId,
				executionId,
				agentId: request.agentId,
				status: 'failed',
				output: undefined,
				metadata,
				error: errorMsg,
			};
		}
	}

	/*-------------------------------------------------------------------------------------------
	 * Execution back-end
	 *
	 * Phase 3 will replace this with:
	 *   const provider = await this.providerManager.selectForAgent(ctx.agentId);
	 *   return provider.execute(ctx, request.payload);
	 *------------------------------------------------------------------------------------------*/

	private async runExecution(
		ctx: IExecutionContext,
		request: IAgentExecutionRequest,
	): Promise<unknown> {
		// Apply optional wall-clock timeout.
		const workPromise = this.doExecute(ctx, request);

		if (ctx.timeoutMs > 0) {
			const timeoutPromise = new Promise<never>((_, reject) =>
				setTimeout(
					() => reject(new Error(`Execution timed out after ${ctx.timeoutMs}ms`)),
					ctx.timeoutMs
				)
			);
			return Promise.race([workPromise, timeoutPromise]);
		}

		return workPromise;
	}

	/**
	 * Concrete execution logic.
	 *
	 * Calls the real Nutanaa Runtime backend via the connection service
	 * so the Chat View displays actual AI responses instead of mock metadata.
	 */
	private async doExecute(
		_ctx: IExecutionContext,
		request: IAgentExecutionRequest,
	): Promise<unknown> {
		const result = await this.connectionService.executeAgent(request.agentId, {
			input: request.payload.input ?? request.payload.context ?? '',
			context: request.payload.context,
		});

		if (!result.success) {
			throw new Error(result.error || 'Agent execution failed');
		}

		return result.output;
	}

	/*-------------------------------------------------------------------------------------------
	 * Event / state helpers
	 *------------------------------------------------------------------------------------------*/

	private fireAgentEvent(
		type: RuntimeEventType,
		agentId: string,
		name: string,
		status: string,
	): void {
		this.eventBus.fire({
			type,
			timestamp: Date.now(),
			payload: { id: agentId, name, status },
		});
	}

	private updateAgentState(agentId: string, status: string): void {
		const existing = this.stateService.getState().agents[agentId];
		if (!existing) {
			return;
		}
		this.stateService.updateAgents({
			...this.stateService.getState().agents,
			[agentId]: {
				...existing,
				summary: { ...existing.summary, status },
			},
		});
	}

	private updateTaskState(
		taskId: string,
		title: string,
		agentId: string,
		state: 'running' | 'completed' | 'failed',
		startedAt: number,
		completedAt: number | undefined,
		errorMessage?: string,
	): void {
		const existing = this.stateService.getState().tasks[taskId];
		this.stateService.updateTasks({
			[taskId]: {
				id: taskId,
				title,
				agentId,
				state,
				createdAt: existing?.createdAt ?? startedAt,
				startedAt,
				completedAt,
				errorMessage,
			},
		});
	}

	private updateAgentMetrics(agentId: string, meta: IExecutionMetadata): void {
		const current = this.stateService.getState().metrics;
		const prev = current.byAgent[agentId];

		const updated = {
			agentId,
			activeTasks: 0,
			completedTasks: (prev?.completedTasks ?? 0) + 1,
			failedTasks: prev?.failedTasks ?? 0,
			retriedTasks: (prev?.retriedTasks ?? 0) + meta.retries,
			avgExecutionTimeMs: prev
				? Math.round((prev.avgExecutionTimeMs + meta.durationMs) / 2)
				: meta.durationMs,
			totalTokensUsed: (prev?.totalTokensUsed ?? 0) + meta.tokensUsed,
			totalCostUsd: (prev?.totalCostUsd ?? 0) + meta.costUsd,
			cpuUsagePercent: 0,
			memoryUsageMb: 0,
			uptimeMs: Date.now() - meta.startedAt,
			timestamp: Date.now(),
		};

		this.stateService.updateMetrics({
			byAgent: { ...current.byAgent, [agentId]: updated },
		});
	}

	private buildMetadata(ctx: IExecutionContext, completedAt: number): IExecutionMetadata {
		return {
			executionId: ctx.executionId,
			agentId: ctx.agentId,
			startedAt: ctx.createdAt,
			completedAt,
			durationMs: completedAt - ctx.createdAt,
			tokensUsed: 0,    // Phase 3 will fill from provider response.
			costUsd: 0,
			retries: 0,
		};
	}
}

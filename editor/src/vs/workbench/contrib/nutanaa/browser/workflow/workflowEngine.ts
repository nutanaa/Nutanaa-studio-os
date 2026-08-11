/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ILogService } from '../../../../../platform/log/common/log.js';

import {
	IWorkflowEngine,
	IWorkflowGraph,
	IWorkflowNode,
	IWorkflowExecution,
	IWorkflowNodeExecution,
} from '../../common/workflow/workflowEngine.js';

import { IAgentCoordinator } from '../../common/agents/agentCoordinator.js';
import { IRuntimeEventBus } from '../../common/runtime/runtimeEventBus.js';
import { IRuntimeStateService } from '../../common/runtime/runtimeState.js';
import { RuntimeEventType } from '../../common/runtime/runtimeEvent.js';

import {
	IWorkflowExecutionRequest,
	IWorkflowExecutionResult,
	IAgentExecutionRequest,
} from '../../models/executionModel.js';

/*---------------------------------------------------------------------------------------------
 * WorkflowEngine
 *--------------------------------------------------------------------------------------------*/

/**
 * WorkflowEngine — executes IWorkflowGraph instances.
 *
 * Execution model:
 *   1. Build an IWorkflowExecution record and publish WorkflowStarted.
 *   2. Start from entryNodeId and walk the graph.
 *   3. For each node, pick the execution strategy by kind:
 *       agent       → IAgentCoordinator.executeAgent()
 *       parallel    → execute all branches concurrently, await all
 *       conditional → evaluate condition, follow true/false branch
 *       loop        → repeat body while condition is true (capped by maxIterations)
 *       retry       → execute target, retry on failure up to maxAttempts
 *       subWorkflow → recursively call executeWorkflow()
 *       noop        → immediate pass-through
 *   4. After each node, advance to successor nodes via edges.
 *   5. On full completion publish WorkflowCompleted; on any unrecovered
 *      failure publish WorkflowFailed.
 *   6. cancelWorkflow() sets a cancellation flag; the walk checks it before
 *      each node and publishes WorkflowCancelled.
 */
export class WorkflowEngine extends Disposable implements IWorkflowEngine {

	declare readonly _serviceBrand: undefined;

	/*-------------------------------------------------------------------------------------------
	 * Internal state
	 *------------------------------------------------------------------------------------------*/

	private readonly graphs = new Map<string, IWorkflowGraph>();
	private readonly executions = new Map<string, IWorkflowExecution>();
	private readonly cancellationFlags = new Set<string>();

	/*-------------------------------------------------------------------------------------------
	 * Events
	 *------------------------------------------------------------------------------------------*/

	private readonly _onWorkflowChanged = this._register(new Emitter<IWorkflowExecution>());
	public readonly onWorkflowChanged: Event<IWorkflowExecution> = this._onWorkflowChanged.event;

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
	}

	/*-------------------------------------------------------------------------------------------
	 * IWorkflowEngine — graph registration
	 *------------------------------------------------------------------------------------------*/

	public registerGraph(graph: IWorkflowGraph): void {
		this.graphs.set(graph.workflowId, graph);
	}

	/*-------------------------------------------------------------------------------------------
	 * IWorkflowEngine — execution
	 *------------------------------------------------------------------------------------------*/

	public async executeWorkflow(
		request: IWorkflowExecutionRequest
	): Promise<IWorkflowExecutionResult> {

		const graph = this.graphs.get(request.workflowId);
		if (!graph) {
			throw new Error(`[WorkflowEngine] No graph registered for workflowId: ${request.workflowId}`);
		}

		const executionId = `wf_exec_${request.workflowId}_${Date.now()}`;
		const now = Date.now();

		const execution: IWorkflowExecution = {
			workflowId: request.workflowId,
			executionId,
			status: 'running',
			startedAt: now,
			completedAt: undefined,
			nodeExecutions: new Map(),
			vars: { ...request.vars },
			outputs: {},
		};

		this.executions.set(executionId, execution);

		// Pre-populate node execution records.
		for (const node of graph.nodes) {
			execution.nodeExecutions.set(node.id, {
				nodeId: node.id,
				kind: node.kind,
				status: 'pending',
				startedAt: undefined,
				completedAt: undefined,
				output: undefined,
				error: undefined,
				iteration: 0,
			});
		}

		// Publish WorkflowCreated then WorkflowStarted.
		this.fireWorkflowEvent(RuntimeEventType.WorkflowCreated, execution);
		this.fireWorkflowEvent(RuntimeEventType.WorkflowStarted, execution);
		this.publishWorkflowState(execution);

		try {
			await this.executeNode(graph, graph.entryNodeId, execution, request);

			if (this.cancellationFlags.has(executionId)) {
				return this.finalize(execution, 'cancelled', undefined);
			}

			return this.finalize(execution, 'completed', undefined);

		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.logService.error(`[WorkflowEngine] workflow ${request.workflowId} failed: ${msg}`);
			return this.finalize(execution, 'failed', msg);
		}
	}

	public cancelWorkflow(executionId: string): void {
		const execution = this.executions.get(executionId);
		if (!execution || execution.status !== 'running') {
			return;
		}
		this.cancellationFlags.add(executionId);
		this.logService.info(`[WorkflowEngine] cancellation requested for execution ${executionId}.`);
	}

	/*-------------------------------------------------------------------------------------------
	 * IWorkflowEngine — queries
	 *------------------------------------------------------------------------------------------*/

	public getExecution(executionId: string): IWorkflowExecution | undefined {
		return this.executions.get(executionId);
	}

	public getRunningExecutions(): readonly IWorkflowExecution[] {
		return [...this.executions.values()].filter(e => e.status === 'running');
	}

	/*-------------------------------------------------------------------------------------------
	 * Node execution dispatcher
	 *------------------------------------------------------------------------------------------*/

	private async executeNode(
		graph: IWorkflowGraph,
		nodeId: string,
		execution: IWorkflowExecution,
		request: IWorkflowExecutionRequest,
	): Promise<void> {

		// Cancellation check before every node.
		if (this.cancellationFlags.has(execution.executionId)) {
			return;
		}

		const node = graph.nodes.find(n => n.id === nodeId);
		if (!node) {
			throw new Error(`[WorkflowEngine] node not found: ${nodeId}`);
		}

		const nodeExec = execution.nodeExecutions.get(nodeId)!;
		nodeExec.status = 'running';
		nodeExec.startedAt = Date.now();

		this.logService.trace(`[WorkflowEngine] executing node ${nodeId} (${node.kind})`);

		try {
			switch (node.kind) {
				case 'agent':
					await this.executeAgentNode(node, nodeExec, execution, request);
					break;

				case 'parallel':
					await this.executeParallelNode(node, graph, nodeExec, execution, request);
					break;

				case 'conditional':
					await this.executeConditionalNode(node, graph, nodeExec, execution, request);
					break;

				case 'loop':
					await this.executeLoopNode(node, graph, nodeExec, execution, request);
					break;

				case 'retry':
					await this.executeRetryNode(node, graph, nodeExec, execution, request);
					break;

				case 'subWorkflow':
					await this.executeSubWorkflowNode(node, nodeExec, execution, request);
					break;

				case 'noop':
					nodeExec.output = null;
					break;
			}

			nodeExec.status = 'completed';
			nodeExec.completedAt = Date.now();

			// Store output in execution.outputs for downstream var resolution.
			(execution.outputs as Record<string, unknown>)[nodeId] = nodeExec.output;

		} catch (err) {
			nodeExec.status = 'failed';
			nodeExec.completedAt = Date.now();
			nodeExec.error = err instanceof Error ? err.message : String(err);
			throw err;
		}

		// Advance to successor nodes via edges.
		await this.advanceToSuccessors(graph, nodeId, execution, request);
	}

	/*-------------------------------------------------------------------------------------------
	 * Node kind strategies
	 *------------------------------------------------------------------------------------------*/

	private async executeAgentNode(
		node: IWorkflowNode,
		nodeExec: IWorkflowNodeExecution,
		execution: IWorkflowExecution,
		request: IWorkflowExecutionRequest,
	): Promise<void> {

		if (!node.agentId || !node.taskTitle) {
			throw new Error(`[WorkflowEngine] agent node ${node.id} missing agentId or taskTitle.`);
		}

		const resolvedPayload = this.resolveVars(
			node.taskPayload ?? {},
			execution.vars,
			execution.outputs,
		);

		const agentRequest: IAgentExecutionRequest = {
			requestId: `wf_${execution.executionId}_node_${node.id}_${Date.now()}`,
			agentId: node.agentId,
			title: node.taskTitle,
			payload: resolvedPayload,
			priority: node.priority ?? request.defaultMaxRetries === 0 ? 'normal' : 'normal',
			timeoutMs: node.timeoutMs > 0 ? node.timeoutMs : request.defaultTimeoutMs,
			maxRetries: node.maxRetries >= 0 ? node.maxRetries : request.defaultMaxRetries,
			workflowId: execution.workflowId,
			workflowNodeId: node.id,
		};

		const response = await this.agentCoordinator.executeAgent(agentRequest);

		if (response.status !== 'success') {
			throw new Error(response.error ?? `Agent node ${node.id} failed.`);
		}

		nodeExec.output = response.output;
	}

	private async executeParallelNode(
		node: IWorkflowNode,
		graph: IWorkflowGraph,
		nodeExec: IWorkflowNodeExecution,
		execution: IWorkflowExecution,
		request: IWorkflowExecutionRequest,
	): Promise<void> {

		const branches = node.parallelBranches ?? [];
		if (branches.length === 0) {
			nodeExec.output = null;
			return;
		}

		await Promise.all(
			branches.map(branchNodeId =>
				this.executeNode(graph, branchNodeId, execution, request)
			)
		);

		nodeExec.output = branches.map(id => execution.outputs[id]);
	}

	private async executeConditionalNode(
		node: IWorkflowNode,
		graph: IWorkflowGraph,
		nodeExec: IWorkflowNodeExecution,
		execution: IWorkflowExecution,
		request: IWorkflowExecutionRequest,
	): Promise<void> {

		if (!node.condition) {
			throw new Error(`[WorkflowEngine] conditional node ${node.id} has no condition.`);
		}

		const result = this.evaluateCondition(node.condition, execution.vars, execution.outputs);
		const targetId = result ? node.trueBranch : node.falseBranch;

		nodeExec.output = { condition: result, branch: targetId ?? null };

		if (targetId) {
			await this.executeNode(graph, targetId, execution, request);
		}
	}

	private async executeLoopNode(
		node: IWorkflowNode,
		graph: IWorkflowGraph,
		nodeExec: IWorkflowNodeExecution,
		execution: IWorkflowExecution,
		request: IWorkflowExecutionRequest,
	): Promise<void> {

		if (!node.loopCondition || !node.loopBody) {
			throw new Error(`[WorkflowEngine] loop node ${node.id} missing loopCondition or loopBody.`);
		}

		const maxIter = node.maxIterations > 0 ? node.maxIterations : 100;
		let iteration = 0;

		while (
			iteration < maxIter &&
			!this.cancellationFlags.has(execution.executionId) &&
			this.evaluateCondition(node.loopCondition, execution.vars, execution.outputs)
		) {
			nodeExec.iteration = ++iteration;
			await this.executeNode(graph, node.loopBody, execution, request);
		}

		nodeExec.output = { iterations: iteration };
	}

	private async executeRetryNode(
		node: IWorkflowNode,
		graph: IWorkflowGraph,
		nodeExec: IWorkflowNodeExecution,
		execution: IWorkflowExecution,
		request: IWorkflowExecutionRequest,
	): Promise<void> {

		if (!node.retryTarget) {
			throw new Error(`[WorkflowEngine] retry node ${node.id} missing retryTarget.`);
		}

		const maxAttempts = node.retryMaxAttempts > 0 ? node.retryMaxAttempts : 3;
		const delayMs = node.retryDelayMs > 0 ? node.retryDelayMs : 1000;
		let lastError: string | undefined;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				// Reset the target node's execution record for the retry attempt.
				const targetExec = execution.nodeExecutions.get(node.retryTarget);
				if (targetExec) {
					targetExec.status = 'pending';
					targetExec.error = undefined;
				}

				await this.executeNode(graph, node.retryTarget, execution, request);
				nodeExec.output = execution.outputs[node.retryTarget];
				return; // Success — exit retry loop.
			} catch (err) {
				lastError = err instanceof Error ? err.message : String(err);
				this.logService.warn(
					`[WorkflowEngine] retry node ${node.id}: attempt ${attempt}/${maxAttempts} failed — ${lastError}`
				);

				if (attempt < maxAttempts && !this.cancellationFlags.has(execution.executionId)) {
					await this.sleep(delayMs * Math.pow(2, attempt - 1));
				}
			}
		}

		throw new Error(`Retry node ${node.id} exhausted ${maxAttempts} attempts. Last error: ${lastError}`);
	}

	private async executeSubWorkflowNode(
		node: IWorkflowNode,
		nodeExec: IWorkflowNodeExecution,
		execution: IWorkflowExecution,
		request: IWorkflowExecutionRequest,
	): Promise<void> {

		if (!node.subWorkflow) {
			throw new Error(`[WorkflowEngine] subWorkflow node ${node.id} has no subWorkflow graph.`);
		}

		// Register sub-graph temporarily.
		this.registerGraph(node.subWorkflow);

		const subRequest: IWorkflowExecutionRequest = {
			workflowId: node.subWorkflow.workflowId,
			name: node.subWorkflow.name,
			vars: { ...execution.vars, ...execution.outputs },
			priority: request.defaultMaxRetries > 0 ? 'normal' : 'normal',
			defaultMaxRetries: request.defaultMaxRetries,
			defaultTimeoutMs: request.defaultTimeoutMs,
		};

		const result = await this.executeWorkflow(subRequest);

		if (result.status !== 'completed') {
			throw new Error(`Sub-workflow ${node.subWorkflow.workflowId} ${result.status}: ${result.error ?? ''}`);
		}

		nodeExec.output = result.nodeOutputs;
	}

	/*-------------------------------------------------------------------------------------------
	 * Graph traversal
	 *------------------------------------------------------------------------------------------*/

	private async advanceToSuccessors(
		graph: IWorkflowGraph,
		completedNodeId: string,
		execution: IWorkflowExecution,
		request: IWorkflowExecutionRequest,
	): Promise<void> {

		// Gather all direct successor node ids.
		const successorIds = graph.edges
			.filter(e => e.from === completedNodeId)
			.map(e => e.to);

		if (successorIds.length === 0) {
			return;
		}

		// Filter to nodes whose predecessors are all completed.
		const eligible = successorIds.filter(id => {
			const preds = graph.edges.filter(e => e.to === id).map(e => e.from);
			return preds.every(predId => {
				const exec = execution.nodeExecutions.get(predId);
				return exec?.status === 'completed';
			});
		});

		// Skip nodes that have already run (convergence points).
		const toRun = eligible.filter(id => {
			const exec = execution.nodeExecutions.get(id);
			return exec?.status === 'pending';
		});

		if (toRun.length === 0) {
			return;
		}

		// Execute eligible successors. Multiple successors run in parallel.
		if (toRun.length === 1) {
			await this.executeNode(graph, toRun[0], execution, request);
		} else {
			await Promise.all(toRun.map(id => this.executeNode(graph, id, execution, request)));
		}
	}

	/*-------------------------------------------------------------------------------------------
	 * Finalization
	 *------------------------------------------------------------------------------------------*/

	private finalize(
		execution: IWorkflowExecution,
		status: 'completed' | 'failed' | 'cancelled',
		error: string | undefined,
	): IWorkflowExecutionResult {

		execution.status = status;
		execution.completedAt = Date.now();

		this.cancellationFlags.delete(execution.executionId);

		const eventType =
			status === 'completed' ? RuntimeEventType.WorkflowCompleted :
			status === 'cancelled' ? RuntimeEventType.WorkflowCancelled :
			RuntimeEventType.WorkflowFailed;

		this.fireWorkflowEvent(eventType, execution);
		this.publishWorkflowState(execution);

		return {
			workflowId: execution.workflowId,
			status,
			nodeOutputs: { ...execution.outputs },
			error,
			startedAt: execution.startedAt,
			completedAt: execution.completedAt,
			durationMs: execution.completedAt - execution.startedAt,
		};
	}

	/*-------------------------------------------------------------------------------------------
	 * Condition evaluator
	 *------------------------------------------------------------------------------------------*/

	/**
	 * Evaluate a condition expression string.
	 *
	 * The expression runs in a restricted scope that exposes:
	 *   vars    — current workflow vars
	 *   outputs — current node outputs
	 *
	 * Only boolean results are valid; anything else is treated as false.
	 */
	private evaluateCondition(
		expression: string,
		vars: Record<string, unknown>,
		outputs: Record<string, unknown>,
	): boolean {
		try {
			// eslint-disable-next-line no-new-func
			const fn = new Function('vars', 'outputs', `return !!(${expression});`);
			return fn(vars, outputs) === true;
		} catch (err) {
			this.logService.warn(
				`[WorkflowEngine] condition evaluation failed: "${expression}" — ${err instanceof Error ? err.message : String(err)}`
			);
			return false;
		}
	}

	/*-------------------------------------------------------------------------------------------
	 * Var resolver
	 *------------------------------------------------------------------------------------------*/

	/**
	 * Replace ${varName} and ${outputs.nodeId} references in payload values.
	 */
	private resolveVars(
		payload: Readonly<Record<string, unknown>>,
		vars: Record<string, unknown>,
		outputs: Record<string, unknown>,
	): Record<string, unknown> {
		const resolved: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(payload)) {
			if (typeof val === 'string') {
				resolved[key] = val.replace(/\$\{([^}]+)\}/g, (_, path) => {
					const parts = path.trim().split('.');
					let cursor: unknown = parts[0] === 'outputs' ? outputs : vars;
					for (const part of parts[0] === 'outputs' ? parts.slice(1) : parts) {
						cursor = (cursor as Record<string, unknown>)?.[part];
					}
					return cursor !== undefined ? String(cursor) : `\${${path}}`;
				});
			} else {
				resolved[key] = val;
			}
		}
		return resolved;
	}

	/*-------------------------------------------------------------------------------------------
	 * Event publishing
	 *------------------------------------------------------------------------------------------*/

	private fireWorkflowEvent(type: RuntimeEventType, execution: IWorkflowExecution): void {
		this.eventBus.fire({
			type,
			timestamp: Date.now(),
			payload: {
				id: execution.workflowId,
				name: execution.workflowId,
				state: execution.status,
			},
		});
		this._onWorkflowChanged.fire(execution);
	}

	private publishWorkflowState(execution: IWorkflowExecution): void {
		this.stateService.updateWorkflows({
			[execution.workflowId]: {
				id: execution.workflowId,
				name: execution.workflowId,
				state: execution.status === 'running' ? 'running' :
					execution.status === 'completed' ? 'completed' :
					execution.status === 'cancelled' ? 'cancelled' : 'failed',
				createdAt: execution.startedAt,
				startedAt: execution.startedAt,
				completedAt: execution.completedAt,
			},
		});
	}

	/*-------------------------------------------------------------------------------------------
	 * Utilities
	 *------------------------------------------------------------------------------------------*/

	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

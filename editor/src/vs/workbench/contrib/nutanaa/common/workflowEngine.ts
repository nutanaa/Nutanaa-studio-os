/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../base/common/event.js';
import { AgentPriority } from '../models/agentModel.js';
import { IWorkflowExecutionRequest, IWorkflowExecutionResult } from '../models/executionModel.js';

/*---------------------------------------------------------------------------------------------
 * Workflow graph types
 *--------------------------------------------------------------------------------------------*/

/** All node kinds the WorkflowEngine understands. */
export type WorkflowNodeKind =
	| 'agent'       // Execute an agent task.
	| 'parallel'    // Execute child nodes in parallel; waits for all.
	| 'conditional' // Choose a branch based on a predicate.
	| 'loop'        // Repeat child node(s) until a condition is false.
	| 'retry'       // Retry child node on failure up to maxAttempts.
	| 'subWorkflow' // Embed another IWorkflowGraph inline.
	| 'noop';       // Pass-through; useful as a fork/join placeholder.

/** A single node in the execution graph. */
export interface IWorkflowNode {
	readonly id: string;
	readonly kind: WorkflowNodeKind;
	readonly label: string;

	// ── agent node ────────────────────────────────────────────────────────
	/** Required when kind === 'agent'. */
	readonly agentId: string | undefined;
	readonly taskTitle: string | undefined;
	/** Payload vars for agent nodes; may reference workflow vars with ${varName}. */
	readonly taskPayload: Readonly<Record<string, unknown>> | undefined;
	readonly priority: AgentPriority | undefined;
	/** Per-node timeout override (0 = use workflow default). */
	readonly timeoutMs: number;
	/** Per-node retry override (-1 = use workflow default). */
	readonly maxRetries: number;

	// ── conditional node ──────────────────────────────────────────────────
	/**
	 * Required when kind === 'conditional'.
	 * JavaScript expression string evaluated against `{ vars, outputs }`.
	 * Must return a boolean.
	 */
	readonly condition: string | undefined;
	/** Node id to execute when condition is true. */
	readonly trueBranch: string | undefined;
	/** Node id to execute when condition is false. */
	readonly falseBranch: string | undefined;

	// ── loop node ─────────────────────────────────────────────────────────
	/**
	 * Required when kind === 'loop'.
	 * JavaScript expression evaluated before each iteration.
	 */
	readonly loopCondition: string | undefined;
	/** Node id of the body to repeat. */
	readonly loopBody: string | undefined;
	/** Hard upper bound on iterations (safety guard, default 100). */
	readonly maxIterations: number;

	// ── retry node ────────────────────────────────────────────────────────
	readonly retryMaxAttempts: number;
	readonly retryDelayMs: number;
	/** Node id of the child to retry. */
	readonly retryTarget: string | undefined;

	// ── subWorkflow node ──────────────────────────────────────────────────
	readonly subWorkflow: IWorkflowGraph | undefined;

	// ── parallel node ─────────────────────────────────────────────────────
	/** For kind === 'parallel': node ids to execute in parallel. */
	readonly parallelBranches: readonly string[] | undefined;
}

/** A directed edge between two nodes. */
export interface IWorkflowEdge {
	readonly from: string; // source node id
	readonly to: string;   // target node id
}

/** The complete execution graph. */
export interface IWorkflowGraph {
	readonly workflowId: string;
	readonly name: string;
	readonly nodes: readonly IWorkflowNode[];
	readonly edges: readonly IWorkflowEdge[];
	/** Id of the node that begins execution. */
	readonly entryNodeId: string;
}

/*---------------------------------------------------------------------------------------------
 * Live execution record
 *--------------------------------------------------------------------------------------------*/

export type WorkflowNodeStatus =
	| 'pending'
	| 'running'
	| 'completed'
	| 'failed'
	| 'skipped'
	| 'cancelled';

export interface IWorkflowNodeExecution {
	readonly nodeId: string;
	readonly kind: WorkflowNodeKind;
	status: WorkflowNodeStatus;
	startedAt: number | undefined;
	completedAt: number | undefined;
	output: unknown;
	error: string | undefined;
	/** Iteration count for loop nodes. */
	iteration: number;
}

export interface IWorkflowExecution {
	readonly workflowId: string;
	readonly executionId: string;
	status: 'running' | 'completed' | 'failed' | 'cancelled';
	readonly startedAt: number;
	completedAt: number | undefined;
	readonly nodeExecutions: Map<string, IWorkflowNodeExecution>;
	/** Resolved workflow vars (request.vars merged with node outputs). */
	vars: Record<string, unknown>;
	/** Node outputs keyed by node id. */
	readonly outputs: Record<string, unknown>;
}

/*---------------------------------------------------------------------------------------------
 * DI token
 *--------------------------------------------------------------------------------------------*/

export const IWorkflowEngine = createDecorator<IWorkflowEngine>('workflowEngine');

/*---------------------------------------------------------------------------------------------
 * Interface
 *--------------------------------------------------------------------------------------------*/

/**
 * IWorkflowEngine — graph-based workflow executor.
 *
 * Responsibilities:
 *  • Accept an IWorkflowGraph and IWorkflowExecutionRequest.
 *  • Walk the graph, resolving dependencies.
 *  • Execute nodes in parallel where edges allow.
 *  • Evaluate conditions for conditional/loop nodes.
 *  • Retry failing nodes per their retry policy.
 *  • Support cancellation of running workflows.
 *  • Publish every state change onto IRuntimeEventBus.
 *  • Write workflow and task slices into IRuntimeStateService.
 */
export interface IWorkflowEngine {

	readonly _serviceBrand: undefined;

	// ── Events ────────────────────────────────────────────────────────────

	/** Fires whenever a workflow execution changes state. */
	readonly onWorkflowChanged: Event<IWorkflowExecution>;

	// ── Execution ─────────────────────────────────────────────────────────

	/**
	 * Register a workflow graph so it can be referenced by id.
	 * Re-registering the same id replaces the graph.
	 */
	registerGraph(graph: IWorkflowGraph): void;

	/**
	 * Execute a previously registered workflow graph.
	 * Resolves with IWorkflowExecutionResult when the workflow reaches a
	 * terminal state (completed, failed, or cancelled).
	 */
	executeWorkflow(request: IWorkflowExecutionRequest): Promise<IWorkflowExecutionResult>;

	/**
	 * Cancel a running workflow by its execution id.
	 */
	cancelWorkflow(executionId: string): void;

	// ── Queries ───────────────────────────────────────────────────────────

	getExecution(executionId: string): IWorkflowExecution | undefined;

	getRunningExecutions(): readonly IWorkflowExecution[];
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AgentPriority } from './agentModel.js';

/*---------------------------------------------------------------------------------------------
 * Execution context — passed into every execution unit so it can read its
 * own identity, configuration limits, and parent provenance.
 *--------------------------------------------------------------------------------------------*/

export interface IExecutionContext {
	/** Unique id for this particular execution attempt. */
	readonly executionId: string;
	/** The agent carrying out this execution. */
	readonly agentId: string;
	/** Optional workflow that spawned this execution. */
	readonly workflowId: string | undefined;
	/** Optional task inside a workflow that spawned this execution. */
	readonly workflowNodeId: string | undefined;
	/** Unix ms at which the execution was created. */
	readonly createdAt: number;
	/** Hard wall-clock time limit in ms (0 = unlimited). */
	readonly timeoutMs: number;
	/** Arbitrary caller-supplied key/value pairs (prompt vars, env, etc.). */
	readonly vars: Readonly<Record<string, unknown>>;
}

/*---------------------------------------------------------------------------------------------
 * Execution metadata — written back once execution finishes, successful or not.
 *--------------------------------------------------------------------------------------------*/

export interface IExecutionMetadata {
	readonly executionId: string;
	readonly agentId: string;
	readonly startedAt: number;
	readonly completedAt: number;
	readonly durationMs: number;
	readonly tokensUsed: number;
	readonly costUsd: number;
	/** Number of retry attempts consumed. */
	readonly retries: number;
}

/*---------------------------------------------------------------------------------------------
 * Agent execution request / result
 *--------------------------------------------------------------------------------------------*/

export interface IAgentExecutionRequest {
	/** Client-supplied idempotency key; generated if omitted. */
	readonly requestId: string;
	readonly agentId: string;
	readonly title: string;
	/** Arbitrary payload forwarded to the provider. */
	readonly payload: Readonly<Record<string, unknown>>;
	readonly priority: AgentPriority;
	/** Wall-clock timeout for this single request in ms (0 = use agent default). */
	readonly timeoutMs: number;
	/** Max retries on transient failures. */
	readonly maxRetries: number;
	/** Optional parent workflow context. */
	readonly workflowId: string | undefined;
	readonly workflowNodeId: string | undefined;
}

export interface IAgentExecutionResponse {
	readonly requestId: string;
	readonly executionId: string;
	readonly agentId: string;
	readonly status: 'success' | 'failed' | 'cancelled' | 'timeout';
	/** Raw provider output. */
	readonly output: unknown;
	readonly metadata: IExecutionMetadata;
	readonly error: string | undefined;
}

/*---------------------------------------------------------------------------------------------
 * Task definition / result
 *
 * A TaskDefinition is the unit of work submitted to ITaskScheduler.
 * It wraps an IAgentExecutionRequest plus scheduling attributes.
 *--------------------------------------------------------------------------------------------*/

export interface ITaskDefinition {
	/** Stable task identity (client-provided or auto-generated). */
	readonly taskId: string;
	readonly request: IAgentExecutionRequest;
	/** Tasks with listed ids must complete before this task starts. */
	readonly dependsOn: readonly string[];
	/** Earliest Unix ms at which the task may be dispatched. */
	readonly notBefore: number | undefined;
	/** Whether the task should be retried on failure (overrides request.maxRetries). */
	readonly maxRetries: number;
	/** Per-task timeout override in ms (0 = use request default). */
	readonly timeoutMs: number;
	/** Whether to run in the background (lower priority, no caller waiting). */
	readonly background: boolean;
}

export interface ITaskResult {
	readonly taskId: string;
	readonly status: 'completed' | 'failed' | 'cancelled' | 'timeout';
	readonly response: IAgentExecutionResponse | undefined;
	readonly error: string | undefined;
	readonly enqueuedAt: number;
	readonly startedAt: number | undefined;
	readonly completedAt: number | undefined;
	readonly retryCount: number;
}

/*---------------------------------------------------------------------------------------------
 * Scheduled task entry — internal scheduler record, not part of the public API.
 *--------------------------------------------------------------------------------------------*/

export interface IScheduledTask {
	readonly taskId: string;
	readonly definition: ITaskDefinition;
	/** Current lifecycle state inside the scheduler. */
	state: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
	readonly enqueuedAt: number;
	startedAt: number | undefined;
	completedAt: number | undefined;
	retryCount: number;
	/** Resolve/reject bound to the Promise returned by ITaskScheduler.submit(). */
	readonly resolve: (result: ITaskResult) => void;
	readonly reject: (err: Error) => void;
}

/*---------------------------------------------------------------------------------------------
 * Workflow execution request / result
 *--------------------------------------------------------------------------------------------*/

export interface IWorkflowExecutionRequest {
	readonly workflowId: string;
	/** Human-readable label shown in the Workflow Explorer. */
	readonly name: string;
	/** Initial variables available to every node in the graph. */
	readonly vars: Readonly<Record<string, unknown>>;
	readonly priority: AgentPriority;
	/** Max retries for individual failing nodes (node-level override wins). */
	readonly defaultMaxRetries: number;
	/** Default timeout per node in ms. */
	readonly defaultTimeoutMs: number;
}

export interface IWorkflowExecutionResult {
	readonly workflowId: string;
	readonly status: 'completed' | 'failed' | 'cancelled';
	/** Outputs keyed by node id. */
	readonly nodeOutputs: Readonly<Record<string, unknown>>;
	/** Error message when status === 'failed'. */
	readonly error: string | undefined;
	readonly startedAt: number;
	readonly completedAt: number;
	readonly durationMs: number;
}

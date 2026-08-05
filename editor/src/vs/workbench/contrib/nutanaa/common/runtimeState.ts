/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../base/common/event.js';
import { NutanaaRuntimeConnectionState, INutanaaAgentSummary, INutanaaProviderSummary } from './nutanaa.js';
import { IAgentMetrics, IAgentSystemHealth } from '../models/agentMetricsModel.js';
import { IAgentQueueStatus } from '../models/agentQueueModel.js';
import { IMemoryEntry, MemoryType } from '../models/memoryModel.js';

/*---------------------------------------------------------------------------------------------
 * DI token
 *--------------------------------------------------------------------------------------------*/

export const IRuntimeStateService = createDecorator<IRuntimeStateService>('runtimeStateService');

/*---------------------------------------------------------------------------------------------
 * State slice types
 *
 * Each slice is a plain, readonly value object. RuntimeStateService holds
 * one IRuntimeState and replaces slices immutably on every update so that
 * consumers can do strict-equality diffing.
 *--------------------------------------------------------------------------------------------*/

/**
 * Connection slice — mirrors NutanaaRuntimeConnectionState plus metadata.
 */
export interface IConnectionState {
	readonly status: NutanaaRuntimeConnectionState;
	/** ISO-8601 timestamp of the last successful connection. */
	readonly lastConnectedAt: number | undefined;
	/** ISO-8601 timestamp of the last error. */
	readonly lastErrorAt: number | undefined;
	/** Human-readable reason for the last error, if any. */
	readonly lastErrorMessage: string | undefined;
	/** Total number of reconnect attempts since startup. */
	readonly reconnectAttempts: number;
}

/**
 * Per-agent runtime state as seen by the editor.
 *
 * Agents arrive from two sources:
 *  - the backend `/agents` endpoint   → populates `summary`
 *  - AgentCoordinator / AgentEventBus → populates `metrics` and `queue`
 */
export interface IRuntimeAgentState {
	/** Raw summary as reported by the Nutanaa Runtime backend. */
	readonly summary: INutanaaAgentSummary;
	/** Live metrics for this agent, if available. */
	readonly metrics: IAgentMetrics | undefined;
	/** Queue snapshot for this agent, if available. */
	readonly queue: IAgentQueueStatus | undefined;
}

/**
 * Provider slice — one entry per provider registered with the backend.
 */
export interface IProviderState {
	readonly summary: INutanaaProviderSummary;
	/** Monotonic timestamp of the last health probe. */
	readonly lastCheckedAt: number;
}

/**
 * Task slice — a lightweight projection used by the Task Explorer view.
 */
export interface ITaskState {
	readonly id: string;
	readonly title: string;
	readonly agentId: string;
	/** Maps to TaskEvent.state from runtimeEvent.ts */
	readonly state: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
	readonly createdAt: number;
	readonly startedAt: number | undefined;
	readonly completedAt: number | undefined;
	readonly errorMessage: string | undefined;
}

/**
 * Workflow slice — a lightweight projection used by the Workflow Explorer view.
 */
export interface IWorkflowState {
	readonly id: string;
	readonly name: string;
	/** Maps to WorkflowEvent.state from runtimeEvent.ts */
	readonly state: 'created' | 'running' | 'completed' | 'failed' | 'cancelled';
	readonly createdAt: number;
	readonly startedAt: number | undefined;
	readonly completedAt: number | undefined;
}

/**
 * A single structured log entry.
 */
export interface ILogEntry {
	readonly id: string;
	readonly level: 'info' | 'warning' | 'error';
	readonly message: string;
	readonly source: string | undefined;
	readonly timestamp: number;
}

/**
 * Memory slice — summary of what is currently indexed per memory type.
 */
export interface IMemoryState {
	/** Total number of entries across all memory types. */
	readonly totalEntries: number;
	/** Count breakdown by memory type. */
	readonly countByType: Readonly<Record<MemoryType, number>>;
	/** Most recently updated entries, capped at MAX_RECENT_MEMORY_ENTRIES. */
	readonly recentEntries: readonly IMemoryEntry[];
	/** ISO timestamp of the last memory write. */
	readonly lastUpdatedAt: number | undefined;
}

/**
 * A notification shown in the notification centre / Agent Monitor.
 */
export interface INotificationState {
	readonly id: string;
	readonly title: string;
	readonly message: string;
	readonly timestamp: number;
	readonly dismissed: boolean;
}

/**
 * Aggregate system-health metrics for the Agent Monitor dashboard.
 */
export interface IMetricsState {
	readonly systemHealth: IAgentSystemHealth | undefined;
	/** Per-agent metrics keyed by agent id. */
	readonly byAgent: Readonly<Record<string, IAgentMetrics>>;
}

/**
 * A Nutanaa session (conversation / task context).
 */
export interface ISessionState {
	readonly id: string;
	readonly agentId: string;
	readonly startedAt: number;
	/** Context entries stored by key. */
	readonly context: Readonly<Record<string, unknown>>;
	readonly active: boolean;
}

/*---------------------------------------------------------------------------------------------
 * Top-level IRuntimeState
 *--------------------------------------------------------------------------------------------*/

/**
 * The single source of truth for all Nutanaa runtime data inside the editor.
 *
 * Architecture constraint:
 *   Views → IRuntimeStateService → IRuntimeCoordinator → Dispatcher → Backend
 *
 * Views must NEVER read from INutanaaRuntimeConnectionService directly.
 */
export interface IRuntimeState {
	readonly connection: IConnectionState;
	/** Agents keyed by agent id. */
	readonly agents: Readonly<Record<string, IRuntimeAgentState>>;
	/** Providers keyed by provider id. */
	readonly providers: Readonly<Record<string, IProviderState>>;
	/** Tasks keyed by task id. */
	readonly tasks: Readonly<Record<string, ITaskState>>;
	/** Workflows keyed by workflow id. */
	readonly workflows: Readonly<Record<string, IWorkflowState>>;
	/** Ordered log ring-buffer (newest last). */
	readonly logs: readonly ILogEntry[];
	readonly memory: IMemoryState;
	/** Notifications keyed by notification id. */
	readonly notifications: Readonly<Record<string, INotificationState>>;
	readonly metrics: IMetricsState;
	/** Sessions keyed by session id. */
	readonly sessions: Readonly<Record<string, ISessionState>>;
}

/*---------------------------------------------------------------------------------------------
 * Snapshot
 *--------------------------------------------------------------------------------------------*/

/**
 * An immutable, timestamped copy of IRuntimeState.
 */
export interface IRuntimeStateSnapshot {
	readonly timestamp: number;
	readonly state: IRuntimeState;
}

/*---------------------------------------------------------------------------------------------
 * Partial update type
 *
 * Callers pass a Partial<IRuntimeState> to update(). The service merges it
 * into the current state and fires onDidChangeState with the new snapshot.
 * Slice keys that are omitted are left unchanged.
 *--------------------------------------------------------------------------------------------*/

export type RuntimeStateUpdate = Partial<IRuntimeState>;

/*---------------------------------------------------------------------------------------------
 * IRuntimeStateService
 *--------------------------------------------------------------------------------------------*/

/**
 * The single source of truth for runtime state.
 *
 * All views and commands must read state exclusively through this service.
 * State is written only by RuntimeStateService itself in response to
 * RuntimeEventBus events forwarded by RuntimeCoordinator.
 */
export interface IRuntimeStateService {

	readonly _serviceBrand: undefined;

	/**
	 * Fired after every state mutation.
	 * Subscribers receive the complete new state; they may diff against a
	 * locally cached copy if they need to know which slice changed.
	 */
	readonly onDidChangeState: Event<IRuntimeState>;

	/**
	 * Returns the current (latest) state object.
	 * The returned reference is frozen and must not be mutated by callers.
	 */
	getState(): IRuntimeState;

	/**
	 * Merge `update` into the current state and fire `onDidChangeState`.
	 *
	 * RuntimeStateService is the ONLY writer. No other service or view
	 * should call this method.
	 *
	 * @internal Called by RuntimeStateService in response to bus events.
	 */
	update(update: RuntimeStateUpdate): void;

	/**
	 * Reset all state slices to their initial empty values and fire
	 * `onDidChangeState`. Typically called on runtime disconnect.
	 */
	clear(): void;

	/**
	 * Return an immutable timestamped snapshot of the current state.
	 * Useful for diagnostics, logging, and timeline recording.
	 */
	snapshot(): IRuntimeStateSnapshot;
}

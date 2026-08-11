/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../../base/common/event.js';
import { NutanaaRuntimeConnectionState, INutanaaAgentSummary, INutanaaProviderSummary } from '../nutanaa.js';
import { IAgentMetrics, IAgentSystemHealth } from '../../models/agentMetricsModel.js';
import { IAgentQueueStatus } from '../../models/agentQueueModel.js';
import { IMemoryEntry, MemoryType } from '../../models/memoryModel.js';
import { IUser, IOrganization, IPlugin, ISecret, IPermission } from '../../models/enterpriseModel.js';

/*---------------------------------------------------------------------------------------------
 * Phase 6 Production State Slices
 *--------------------------------------------------------------------------------------------*/

/**
 * Production platform state for monitoring, caching, backup, and updates.
 */
export interface IProductionState {
	/** Telemetry state */
	readonly telemetry: {
		enabled: boolean;
		anonymous: boolean;
		eventsCount: number;
		sessionsCount: number;
	};
	/** Metrics state */
	readonly metrics: {
		cpu: number;
		memory: number;
		gpu: number;
		disk: number;
		network: number;
		llmLatency: number;
		toolLatency: number;
		workflowLatency: number;
		agentLatency: number;
		tokenUsage: number;
	};
	/** Tracing state */
	readonly tracing: {
		enabled: boolean;
		activeTraces: number;
		sampleRate: number;
	};
	/** Logging state */
	readonly logging: {
		level: 'debug' | 'info' | 'warning' | 'error';
		entriesCount: number;
		retention: number;
	};
	/** Performance state */
	readonly performance: {
		startupTime: number;
		renderTime: number;
		slowTasks: number;
		memoryUsage: number;
		cpuUsage: number;
	};
	/** Cache state */
	readonly cache: {
		memorySize: number;
		diskSize: number;
		hitRate: number;
		evictions: number;
		embeddingCount: number;
		promptCount: number;
		toolCount: number;
		httpCount: number;
		providerCount: number;
	};
	/** Offline state */
	readonly offline: {
		enabled: boolean;
		isOffline: boolean;
		queuedRequests: number;
		lastSyncTime: number;
	};
	/** Backup state */
	readonly backup: {
		enabled: boolean;
		lastBackup: number | undefined;
		backupCount: number;
		totalSize: number;
	};
	/** Recovery state */
	readonly recovery: {
		lastRecovery: number | undefined;
		recoveryCount: number;
		pendingRecovery: boolean;
	};
	/** Update state */
	readonly update: {
		channel: 'stable' | 'preview' | 'nightly';
		available: boolean;
		downloading: boolean;
		installing: boolean;
		lastCheck: number | undefined;
		currentVersion: string;
		availableVersion: string | undefined;
	};
	/** Packaging state */
	readonly packaging: {
		isBuilding: boolean;
		buildProgress: number;
		artifactCount: number;
		buildChannel: 'stable' | 'preview' | 'nightly';
	};
	/** Configuration state */
	readonly configuration: {
		profileCount: number;
		activeProfile: string;
		configVersion: string;
	};
	/** Health state */
	readonly health: {
		status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
		score: number;
		ready: boolean;
		alive: boolean;
	};
}

/**
 * Production telemetry update payload.
 */
export interface ITelemetryUpdate {
	enabled?: boolean;
	anonymous?: boolean;
	eventsCount?: number;
	sessionsCount?: number;
}

/**
 * Production metrics update payload.
 */
export interface IMetricsUpdate {
	cpu?: number;
	memory?: number;
	gpu?: number;
	disk?: number;
	network?: number;
	llmLatency?: number;
	toolLatency?: number;
	workflowLatency?: number;
	agentLatency?: number;
	tokenUsage?: number;
}

/**
 * Production tracing update payload.
 */
export interface ITracingUpdate {
	enabled?: boolean;
	activeTraces?: number;
	sampleRate?: number;
}

/**
 * Production logging update payload.
 */
export interface ILoggingUpdate {
	level?: 'debug' | 'info' | 'warning' | 'error';
	entriesCount?: number;
	retention?: number;
}

/**
 * Production performance update payload.
 */
export interface IPerformanceUpdate {
	startupTime?: number;
	renderTime?: number;
	slowTasks?: number;
	memoryUsage?: number;
	cpuUsage?: number;
}

/**
 * Production cache update payload.
 */
export interface ICacheUpdate {
	memorySize?: number;
	diskSize?: number;
	hitRate?: number;
	evictions?: number;
	embeddingCount?: number;
	promptCount?: number;
	toolCount?: number;
	httpCount?: number;
	providerCount?: number;
}

/**
 * Production offline update payload.
 */
export interface IOfflineUpdate {
	enabled?: boolean;
	isOffline?: boolean;
	queuedRequests?: number;
	lastSyncTime?: number;
}

/**
 * Production backup update payload.
 */
export interface IBackupUpdate {
	enabled?: boolean;
	lastBackup?: number;
	backupCount?: number;
	totalSize?: number;
}

/**
 * Production recovery update payload.
 */
export interface IRecoveryUpdate {
	lastRecovery?: number;
	recoveryCount?: number;
	pendingRecovery?: boolean;
}

/**
 * Production update payload.
 */
export interface IProductionUpdate {
	telemetry?: ITelemetryUpdate;
	metrics?: IMetricsUpdate;
	tracing?: ITracingUpdate;
	logging?: ILoggingUpdate;
	performance?: IPerformanceUpdate;
	cache?: ICacheUpdate;
	offline?: IOfflineUpdate;
	backup?: IBackupUpdate;
	recovery?: IRecoveryUpdate;
	update?: {
		channel?: 'stable' | 'preview' | 'nightly';
		available?: boolean;
		downloading?: boolean;
		installing?: boolean;
		lastCheck?: number;
		currentVersion?: string;
		availableVersion?: string;
	};
	packaging?: {
		isBuilding?: boolean;
		buildProgress?: number;
		artifactCount?: number;
		buildChannel?: 'stable' | 'preview' | 'nightly';
	};
	configuration?: {
		profileCount?: number;
		activeProfile?: string;
		configVersion?: string;
	};
	health?: {
		status?: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
		score?: number;
		ready?: boolean;
		alive?: boolean;
	};
}

/*---------------------------------------------------------------------------------------------
 * DI token
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 * Phase 5 Enterprise State Slices
 *--------------------------------------------------------------------------------------------*/

/**
 * Enterprise authentication and authorization state.
 */
export interface IEnterpriseState {
	/** Current authenticated user */
	readonly currentUser: IUser | undefined;
	/** Current organization */
	readonly currentOrganization: IOrganization | undefined;
	/** Current session */
	readonly session: unknown | undefined;
	/** Whether user is authenticated */
	readonly isAuthenticated: boolean;
	/** User's effective permissions */
	readonly userPermissions: IPermission[];
	/** User's assigned roles */
	readonly userRoles: string[];
	/** Team IDs user belongs to in current organization */
	readonly organizationTeamIds: string[];
}

/**
 * Cluster state for distributed runtime.
 */
export interface IClusterStateSlice {
	/** Nodes keyed by node id */
	readonly nodes: ReadonlyMap<string, { nodeId: string; status: 'online' | 'offline' | 'degraded'; load: number; lastSeen: number }>;
	/** Current master node id */
	readonly masterNode: string | undefined;
	/** Total cluster load */
	readonly totalLoad: number;
	/** Average load across nodes */
	readonly averageLoad: number;
}

/**
 * Plugin state.
 */
export interface IPluginsStateSlice {
	/** Installed plugins keyed by plugin id */
	readonly installed: ReadonlyMap<string, IPlugin>;
	/** Cached marketplace listings */
	readonly marketplace: Array<{ id: string; name: string; displayName: string }>;
}

/**
 * Secrets state.
 */
export interface ISecretsStateSlice {
	/** Secrets keyed by secret id */
	readonly secrets: ReadonlyMap<string, ISecret>;
	/** Access log entries */
	readonly accessLog: Array<{ secretId: string; userId: string; accessedAt: number; accessType: 'read' | 'write' | 'admin' }>;
}

/*---------------------------------------------------------------------------------------------
 * DI token
 *--------------------------------------------------------------------------------------------*/

export const IRuntimeStateService = createDecorator<IRuntimeStateService>('runtimeStateService');

/*---------------------------------------------------------------------------------------------
 * State slice types
 *
 * Every slice is a plain readonly value object. The service holds a single
 * IRuntimeState and replaces slices immutably on every write so that
 * subscribers can use strict-equality diffing.
 *--------------------------------------------------------------------------------------------*/

/**
 * Connection slice — mirrors NutanaaRuntimeConnectionState plus audit metadata.
 */
export interface IConnectionState {
	readonly status: NutanaaRuntimeConnectionState;
	/** Unix ms timestamp of the most recent successful connection. */
	readonly lastConnectedAt: number | undefined;
	/** Unix ms timestamp of the most recent connection error. */
	readonly lastErrorAt: number | undefined;
	/** Human-readable reason for the most recent error, if any. */
	readonly lastErrorMessage: string | undefined;
	/** Total reconnect attempts since startup. */
	readonly reconnectAttempts: number;
}

/**
 * Per-agent runtime state as seen by the editor.
 *
 * Agents arrive from two sources:
 *   - the backend `/agents` endpoint   → populates `summary`
 *   - AgentCoordinator / bus events    → also updates `summary.status`
 *   - Phase 2 AgentDispatcher          → populates `metrics` and `queue`
 */
export interface IRuntimeAgentState {
	/** Raw summary as reported by the Nutanaa Runtime backend. */
	readonly summary: INutanaaAgentSummary;
	/** Live per-agent metrics, if available. */
	readonly metrics: IAgentMetrics | undefined;
	/** Queue snapshot for this agent, if available. */
	readonly queue: IAgentQueueStatus | undefined;
}

/**
 * Provider slice — one entry per provider registered with the backend.
 */
export interface IProviderState {
	readonly summary: INutanaaProviderSummary;
	/** Unix ms timestamp of the last health probe. */
	readonly lastCheckedAt: number;
	readonly [key: string]: unknown;
}

/**
 * Task slice — lightweight projection used by the Task Explorer view.
 */
export interface ITaskState {
	readonly id: string;
	readonly title: string;
	readonly agentId: string;
	readonly state: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
	readonly createdAt: number;
	readonly startedAt: number | undefined;
	readonly completedAt: number | undefined;
	readonly errorMessage: string | undefined;
}

/**
 * Workflow slice — lightweight projection used by the Workflow Explorer view.
 */
export interface IWorkflowState {
	readonly id: string;
	readonly name: string;
	readonly state: 'created' | 'running' | 'completed' | 'failed' | 'cancelled';
	readonly createdAt: number;
	readonly startedAt: number | undefined;
	readonly completedAt: number | undefined;
}

/**
 * A single structured log entry held in the ring buffer.
 */
export interface ILogEntry {
	readonly id: string;
	readonly level: 'info' | 'warning' | 'error';
	readonly message: string;
	readonly source: string | undefined;
	readonly timestamp: number;
}

/**
 * Memory slice — summary of what is currently indexed per type.
 * Phase 3 MemoryManager will write richer data via updateMemory().
 */
export interface IMemoryState {
	/** Total number of entries across all memory types. */
	readonly totalEntries: number;
	/** Count breakdown by memory type. */
	readonly countByType: Readonly<Record<MemoryType, number>>;
	/** Most recently updated entries (capped at 50). */
	readonly recentEntries: readonly IMemoryEntry[];
	/** Alias for recentEntries for backward compatibility */
	readonly recent?: readonly IMemoryEntry[];
	/** Unix ms timestamp of the last memory write. */
	readonly lastUpdatedAt: number | undefined;
	/** Embedding statistics */
	readonly embeddingStats?: {
		readonly totalEmbeddings: number;
		readonly totalChunks: number;
		readonly averageDimensions: number;
	};
}

/**
 * A notification held in the notification centre / Agent Monitor panel.
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
 * A Nutanaa session (conversation / task execution context).
 */
export interface ISessionState {
	readonly id: string;
	readonly agentId: string;
	readonly startedAt: number;
	/** Arbitrary context entries stored by key. */
	readonly context: Readonly<Record<string, unknown>>;
	readonly active: boolean;
}

/*---------------------------------------------------------------------------------------------
 * Top-level IRuntimeState
 *--------------------------------------------------------------------------------------------*/

/**
 * The single source of truth for all Nutanaa runtime data inside the editor.
 *
 * Architecture law:
 *   Views → IRuntimeStateService → IRuntimeCoordinator → Dispatcher → Backend
 *
 * No view, panel, or downstream service may hold its own cached copy of
 * runtime data. Everything is read exclusively through IRuntimeStateService.
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
	/** Ordered log ring-buffer, newest last (max 2 000 entries). */
	readonly logs: readonly ILogEntry[];
	readonly memory: IMemoryState;
	/** Notifications keyed by notification id. */
	readonly notifications: Readonly<Record<string, INotificationState>>;
	readonly metrics: IMetricsState;
	/** Sessions keyed by session id. */
	readonly sessions: Readonly<Record<string, ISessionState>>;

	/*---------------------------------------------------------------------------------------------
	 * Phase 5 Enterprise Slices
	 *--------------------------------------------------------------------------------------------*/

	/** Enterprise authentication and authorization state */
	readonly enterprise: IEnterpriseState;
	/** Cluster state for distributed runtime */
	readonly clusterState: IClusterStateSlice;
	/** Plugin state */
	readonly enterprisePlugins: IPluginsStateSlice;
	/** Secrets state */
	readonly enterpriseSecrets: ISecretsStateSlice;

	/*---------------------------------------------------------------------------------------------
	 * Phase 6 Production Slices
	 *--------------------------------------------------------------------------------------------*/

	/** Production platform state */
	readonly production: IProductionState;
}

/*---------------------------------------------------------------------------------------------
 * Snapshot
 *--------------------------------------------------------------------------------------------*/

/**
 * An immutable, timestamped copy of IRuntimeState.
 * Useful for the Timeline view, diagnostics, and export.
 */
export interface IRuntimeStateSnapshot {
	readonly timestamp: number;
	readonly state: IRuntimeState;
}

/*---------------------------------------------------------------------------------------------
 * Granular update argument types
 *--------------------------------------------------------------------------------------------*/

/** Argument for updateConnection(). */
export type ConnectionUpdate = Partial<IConnectionState>;

/** Argument for updateAgents() — keyed by agent id. */
export type AgentUpdate = Readonly<Record<string, IRuntimeAgentState>>;

/** Argument for updateProviders() — keyed by provider id. */
export type ProviderUpdate = Readonly<Record<string, IProviderState>>;

/** Argument for updateTasks() — keyed by task id. */
export type TaskUpdate = Readonly<Record<string, ITaskState>>;

/** Argument for updateWorkflows() — keyed by workflow id. */
export type WorkflowUpdate = Readonly<Record<string, IWorkflowState>>;

/** Argument for updateMetrics(). */
export type MetricsUpdate = Partial<IMetricsState>;

/*---------------------------------------------------------------------------------------------
 * Phase 3 AI Core Update Types
 *--------------------------------------------------------------------------------------------*/

import { IModelInfo, IPromptTemplate, IToolDefinition, ProviderType, IProviderHealth } from '../../models/aiCore.js';
import { IMemoryStats } from '../../models/aiCore.js';

/** Extended ProviderUpdate for Phase 3 AI Core */
export type AIProviderUpdate = {
	/** Add new providers */
	added?: Array<{
		name: string;
		type: ProviderType;
		model: string;
		enabled: boolean;
		health: IProviderHealth;
	}>;
	/** Remove providers */
	removed?: string[];
	/** Update existing providers */
	updated?: Array<{
		name: string;
		type: ProviderType;
		model: string;
		enabled: boolean;
		health: IProviderHealth;
	}>;
	/** Update health status */
	healthUpdates?: Array<{ name: string; health: IProviderHealth }>;
	/** Select a provider */
	selected?: string;
	/** Add new models */
	addedModels?: IModelInfo[];
	/** Remove models */
	removedModels?: string[];
	/** Update models */
	updatedModels?: IModelInfo[];
	/** Update default model */
	defaultModelUpdates?: Array<{ providerType: ProviderType; modelId: string }>;
	/** Set global default model */
	globalDefaultModel?: string;
	/** Add new prompts */
	addedPrompts?: IPromptTemplate[];
	/** Remove prompts */
	removedPrompts?: string[];
	/** Update prompts */
	updatedPrompts?: IPromptTemplate[];
	/** Add new tools */
	addedTools?: IToolDefinition[];
	/** Remove tools */
	removedTools?: string[];
	/** Update tools */
	updatedTools?: IToolDefinition[];
	/** Memory updates */
	memoryUpdates?: {
		added?: Array<{ id: string; type: string; content: string }>;
		updated?: Array<{ id: string; type: string; content: string }>;
		deleted?: string[];
		cleared?: string;
		stats?: IMemoryStats;
	};
	/** Embedding statistics */
	embeddingStats?: {
		totalEmbeddings: number;
		totalChunks: number;
		averageDimensions: number;
	};
};

/*---------------------------------------------------------------------------------------------
 * IRuntimeStateService
 *--------------------------------------------------------------------------------------------*/

/**
 * The single source of truth for all Nutanaa runtime state.
 *
 * ── Reads ──────────────────────────────────────────────────────────────────
 *   getState()   — synchronous snapshot of current state
 *   snapshot()   — timestamped, immutable copy
 *
 * ── Granular writes ────────────────────────────────────────────────────────
 *   updateConnection()
 *   updateAgents()
 *   updateProviders()
 *   updateTasks()
 *   updateWorkflows()
 *   appendLog()
 *   clearLogs()
 *   updateMetrics()
 *   reset()
 *
 * ── Granular change events ─────────────────────────────────────────────────
 *   onDidChangeState      — fires on every mutation (full state)
 *   onConnectionChanged   — fires only when the connection slice changes
 *   onAgentsChanged       — fires only when the agents map changes
 *   onProvidersChanged    — fires only when the providers map changes
 *   onTasksChanged        — fires only when the tasks map changes
 *   onWorkflowsChanged    — fires only when the workflows map changes
 *   onLogsChanged         — fires only when the log buffer changes
 *
 * ── Internal low-level write ───────────────────────────────────────────────
 *   update()   — merges a Partial<IRuntimeState> and fires all relevant events.
 *                Used internally by RuntimeStateService; RuntimeCoordinator
 *                should call the named methods above, not update() directly.
 */
export interface IRuntimeStateService {

	readonly _serviceBrand: undefined;

	// ── Change events ──────────────────────────────────────────────────────

	/** Fired after every state mutation with the complete new state. */
	readonly onDidChangeState: Event<IRuntimeState>;

	/** Fired when the connection slice changes. */
	readonly onConnectionChanged: Event<IConnectionState>;

	/** Fired when the agents map changes. */
	readonly onAgentsChanged: Event<Readonly<Record<string, IRuntimeAgentState>>>;

	/** Fired when the providers map changes. */
	readonly onProvidersChanged: Event<Readonly<Record<string, IProviderState>>>;

	/** Fired when the tasks map changes. */
	readonly onTasksChanged: Event<Readonly<Record<string, ITaskState>>>;

	/** Fired when the workflows map changes. */
	readonly onWorkflowsChanged: Event<Readonly<Record<string, IWorkflowState>>>;

	/** Fired when the log ring-buffer changes. */
	readonly onLogsChanged: Event<readonly ILogEntry[]>;

	// ── Reads ──────────────────────────────────────────────────────────────

	/**
	 * Returns the current state. The returned object is immutable and must
	 * not be mutated by callers.
	 */
	getState(): IRuntimeState;

	/**
	 * Returns an immutable timestamped copy of the current state.
	 */
	snapshot(): IRuntimeStateSnapshot;

	// ── Named writes ───────────────────────────────────────────────────────

	/**
	 * Merge `patch` into the connection slice and fire onConnectionChanged
	 * (and onDidChangeState).
	 */
	updateConnection(patch: ConnectionUpdate): void;

	/**
	 * Replace the agents map with `agents` and fire onAgentsChanged
	 * (and onDidChangeState).
	 */
	updateAgents(agents: AgentUpdate): void;

	/**
	 * Replace the providers map with `providers` and fire onProvidersChanged
	 * (and onDidChangeState).
	 */
	updateProviders(providers: AIProviderUpdate): void;

	/**
	 * Merge `tasks` into the current tasks map (upsert semantics) and fire
	 * onTasksChanged (and onDidChangeState).
	 */
	updateTasks(tasks: TaskUpdate): void;

	/**
	 * Merge `workflows` into the current workflows map (upsert semantics)
	 * and fire onWorkflowsChanged (and onDidChangeState).
	 */
	updateWorkflows(workflows: WorkflowUpdate): void;

	/**
	 * Append a single entry to the log ring-buffer and fire onLogsChanged
	 * (and onDidChangeState).
	 *
	 * The ring-buffer silently drops the oldest entry once it reaches the
	 * 2 000-entry cap.
	 */
	appendLog(
		message: string,
		level: ILogEntry['level'],
		source?: string,
	): void;

	/**
	 * Empty the log ring-buffer and fire onLogsChanged (and onDidChangeState).
	 */
	clearLogs(): void;

	/**
	 * Merge `patch` into the metrics slice and fire onDidChangeState.
	 */
	updateMetrics(patch: MetricsUpdate): void;

	/**
	 * Reset all slices to their initial empty values and fire onDidChangeState.
	 * Typically called on runtime disconnect.
	 */
	reset(): void;

	// ── Low-level write (internal) ─────────────────────────────────────────

	/**
	 * Merge a `Partial<IRuntimeState>` patch and fire all relevant events.
	 *
	 * @internal RuntimeStateService uses this internally. RuntimeCoordinator
	 * must call the named methods above instead.
	 */
	update(patch: Partial<IRuntimeState>): void;
}

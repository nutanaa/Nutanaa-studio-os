/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ILogService } from '../../../../platform/log/common/log.js';

import {
	IRuntimeStateService,
	IRuntimeState,
	IRuntimeStateSnapshot,
	RuntimeStateUpdate,
	IConnectionState,
	IRuntimeAgentState,
	IProviderState,
	ITaskState,
	IWorkflowState,
	ILogEntry,
	IMemoryState,
	INotificationState,
	IMetricsState,
} from '../common/runtimeState.js';

import {
	IRuntimeEventBus,
} from '../common/runtimeEventBus.js';

import {
	RuntimeEventType,
	RuntimeEvent,
	AgentEvent,
	ProviderEvent,
	WorkflowEvent,
	TaskEvent,
	LogEvent,
	NotificationEvent,
} from '../common/runtimeEvent.js';

import {
	INutanaaRuntimeConnectionService,
	NutanaaRuntimeConnectionState,
} from '../common/nutanaa.js';

/*---------------------------------------------------------------------------------------------
 * Constants
 *--------------------------------------------------------------------------------------------*/

/** Maximum number of log entries kept in the ring buffer. */
const MAX_LOG_ENTRIES = 2000;

/** Maximum number of notifications kept in state (oldest dismissed first). */
const MAX_NOTIFICATIONS = 200;

/*---------------------------------------------------------------------------------------------
 * Initial state factory
 *--------------------------------------------------------------------------------------------*/

function buildInitialConnectionState(): IConnectionState {
	return {
		status: NutanaaRuntimeConnectionState.Disconnected,
		lastConnectedAt: undefined,
		lastErrorAt: undefined,
		lastErrorMessage: undefined,
		reconnectAttempts: 0,
	};
}

function buildInitialMemoryState(): IMemoryState {
	return {
		totalEntries: 0,
		countByType: {
			workspace: 0,
			conversation: 0,
			agent: 0,
			project: 0,
			knowledge: 0,
		},
		recentEntries: [],
		lastUpdatedAt: undefined,
	};
}

function buildInitialMetricsState(): IMetricsState {
	return {
		systemHealth: undefined,
		byAgent: {},
	};
}

function buildInitialState(): IRuntimeState {
	return {
		connection: buildInitialConnectionState(),
		agents: {},
		providers: {},
		tasks: {},
		workflows: {},
		logs: [],
		memory: buildInitialMemoryState(),
		notifications: {},
		metrics: buildInitialMetricsState(),
		sessions: {},
	};
}

/*---------------------------------------------------------------------------------------------
 * RuntimeStateService
 *--------------------------------------------------------------------------------------------*/

/**
 * The single source of truth for all Nutanaa runtime state inside the editor.
 *
 * Data flows in one direction only:
 *
 *   Backend
 *     ↓
 *   NutanaaRuntimeConnectionService   (transport)
 *     ↓
 *   RuntimeCoordinator                (coordination)
 *     ↓
 *   RuntimeEventBus                   (pub/sub)
 *     ↓
 *   RuntimeStateService               (state)
 *     ↓
 *   Views / Chat / Logs / Timeline / Commands / Agent Monitor
 *
 * Views MUST read from this service and NEVER from
 * NutanaaRuntimeConnectionService or RuntimeCoordinator directly.
 *
 * RuntimeStateService is the ONLY writer of IRuntimeState. All state
 * mutations go through `update()` which produces a new immutable state
 * object and fires `onDidChangeState`.
 */
export class RuntimeStateService extends Disposable implements IRuntimeStateService {

	declare readonly _serviceBrand: undefined;

	/*-------------------------------------------------------------------------------------------
	 * Internal state
	 *------------------------------------------------------------------------------------------*/

	private _state: IRuntimeState = buildInitialState();

	/** Monotonically-increasing serial used to generate unique log / notification ids. */
	private _serial = 0;

	/*-------------------------------------------------------------------------------------------
	 * Public event
	 *------------------------------------------------------------------------------------------*/

	private readonly _onDidChangeState = this._register(new Emitter<IRuntimeState>());
	public readonly onDidChangeState: Event<IRuntimeState> = this._onDidChangeState.event;

	/*-------------------------------------------------------------------------------------------
	 * Constructor — wire up subscriptions
	 *------------------------------------------------------------------------------------------*/

	constructor(
		@IRuntimeEventBus private readonly eventBus: IRuntimeEventBus,
		@INutanaaRuntimeConnectionService private readonly connectionService: INutanaaRuntimeConnectionService,
		@ILogService private readonly logService: ILogService,
	) {
		super();

		// Subscribe to the runtime event bus — every subsystem event flows here.
		this._register(this.eventBus.onEvent(e => this.handleEvent(e)));

		// Mirror connection-state changes from the transport layer into our slice.
		this._register(
			this.connectionService.onDidChangeState(state => this.handleConnectionStateChange(state))
		);

		// When agents change (polled by connection service), sync them into state.
		this._register(
			this.connectionService.onDidChangeAgents(() => this.syncAgentsFromBackend())
		);

		// Populate initial connection state from whatever state the service is
		// already in (e.g. if the service was constructed before us).
		this.handleConnectionStateChange(this.connectionService.state);
	}

	/*-------------------------------------------------------------------------------------------
	 * IRuntimeStateService — public API
	 *------------------------------------------------------------------------------------------*/

	public getState(): IRuntimeState {
		return this._state;
	}

	public update(patch: RuntimeStateUpdate): void {
		this._state = { ...this._state, ...patch };
		this._onDidChangeState.fire(this._state);
	}

	public clear(): void {
		this._state = buildInitialState();
		this._serial = 0;
		this._onDidChangeState.fire(this._state);
		this.logService.info('[NutanaaState] state cleared.');
	}

	public snapshot(): IRuntimeStateSnapshot {
		return {
			timestamp: Date.now(),
			state: this._state,
		};
	}

	/*-------------------------------------------------------------------------------------------
	 * Connection state handling
	 *------------------------------------------------------------------------------------------*/

	private handleConnectionStateChange(status: NutanaaRuntimeConnectionState): void {
		const prev = this._state.connection;

		let lastConnectedAt = prev.lastConnectedAt;
		let lastErrorAt = prev.lastErrorAt;
		let lastErrorMessage = prev.lastErrorMessage;
		let reconnectAttempts = prev.reconnectAttempts;

		switch (status) {
			case NutanaaRuntimeConnectionState.Connected:
				lastConnectedAt = Date.now();
				// Pull latest agents and providers now that we are live.
				void this.syncAgentsFromBackend();
				void this.syncProvidersFromBackend();
				break;

			case NutanaaRuntimeConnectionState.Connecting:
				reconnectAttempts = prev.reconnectAttempts + 1;
				break;

			case NutanaaRuntimeConnectionState.Error:
				lastErrorAt = Date.now();
				lastErrorMessage = 'Connection to Nutanaa Runtime failed.';
				break;

			case NutanaaRuntimeConnectionState.Disconnected:
				// Wipe runtime data that is only valid while connected.
				this.update({
					connection: {
						status,
						lastConnectedAt,
						lastErrorAt,
						lastErrorMessage,
						reconnectAttempts,
					},
					agents: {},
					providers: {},
				});
				return;
		}

		const connection: IConnectionState = {
			status,
			lastConnectedAt,
			lastErrorAt,
			lastErrorMessage,
			reconnectAttempts,
		};

		this.update({ connection });
	}

	/*-------------------------------------------------------------------------------------------
	 * Backend sync helpers (called on connect / agents-changed signal)
	 *------------------------------------------------------------------------------------------*/

	private async syncAgentsFromBackend(): Promise<void> {
		if (this.connectionService.state !== NutanaaRuntimeConnectionState.Connected) {
			return;
		}

		try {
			const summaries = await this.connectionService.getAgents();
			const agents: Record<string, IRuntimeAgentState> = {};

			for (const summary of summaries) {
				// Preserve existing per-agent metrics / queue that were populated
				// via bus events so a backend refresh does not clobber them.
				const existing = this._state.agents[summary.id];
				agents[summary.id] = {
					summary,
					metrics: existing?.metrics,
					queue: existing?.queue,
				};
			}

			this.update({ agents });
		} catch (err) {
			this.logService.warn('[NutanaaState] failed to sync agents from backend.', err);
		}
	}

	private async syncProvidersFromBackend(): Promise<void> {
		if (this.connectionService.state !== NutanaaRuntimeConnectionState.Connected) {
			return;
		}

		try {
			const summaries = await this.connectionService.getProviders();
			const providers: Record<string, IProviderState> = {};
			const now = Date.now();

			for (const summary of summaries) {
				providers[summary.id] = {
					summary,
					lastCheckedAt: now,
				};
			}

			this.update({ providers });
		} catch (err) {
			this.logService.warn('[NutanaaState] failed to sync providers from backend.', err);
		}
	}

	/*-------------------------------------------------------------------------------------------
	 * RuntimeEventBus handler — folds every bus event into the correct slice
	 *------------------------------------------------------------------------------------------*/

	private handleEvent(event: RuntimeEvent): void {
		switch (event.type) {

			// ── Runtime connection events ────────────────────────────────────────
			case RuntimeEventType.RuntimeConnected:
				this.handleConnectionStateChange(NutanaaRuntimeConnectionState.Connected);
				break;

			case RuntimeEventType.RuntimeDisconnected:
				this.handleConnectionStateChange(NutanaaRuntimeConnectionState.Disconnected);
				break;

			case RuntimeEventType.RuntimeConnecting:
			case RuntimeEventType.RuntimeReconnect:
				this.handleConnectionStateChange(NutanaaRuntimeConnectionState.Connecting);
				break;

			case RuntimeEventType.RuntimeError:
				this.handleConnectionStateChange(NutanaaRuntimeConnectionState.Error);
				break;

			// ── Agent events ─────────────────────────────────────────────────────
			case RuntimeEventType.AgentRegistered:
			case RuntimeEventType.AgentStarted:
			case RuntimeEventType.AgentQueued:
			case RuntimeEventType.AgentRunning:
			case RuntimeEventType.AgentCompleted:
			case RuntimeEventType.AgentFailed:
			case RuntimeEventType.AgentCancelled:
			case RuntimeEventType.AgentUnregistered:
				this.handleAgentEvent(event.type, event.payload as AgentEvent);
				break;

			// ── Provider events ──────────────────────────────────────────────────
			case RuntimeEventType.ProviderRegistered:
			case RuntimeEventType.ProviderRemoved:
			case RuntimeEventType.ProviderChanged:
			case RuntimeEventType.ProviderHealthy:
			case RuntimeEventType.ProviderUnhealthy:
				this.handleProviderEvent(event.type, event.payload as ProviderEvent);
				break;

			// ── Workflow events ──────────────────────────────────────────────────
			case RuntimeEventType.WorkflowCreated:
			case RuntimeEventType.WorkflowStarted:
			case RuntimeEventType.WorkflowRunning:
			case RuntimeEventType.WorkflowCompleted:
			case RuntimeEventType.WorkflowFailed:
			case RuntimeEventType.WorkflowCancelled:
				this.handleWorkflowEvent(event.type, event.payload as WorkflowEvent);
				break;

			// ── Task events ──────────────────────────────────────────────────────
			case RuntimeEventType.TaskQueued:
			case RuntimeEventType.TaskStarted:
			case RuntimeEventType.TaskCompleted:
			case RuntimeEventType.TaskFailed:
			case RuntimeEventType.TaskCancelled:
				this.handleTaskEvent(event.type, event.payload as TaskEvent);
				break;

			// ── Memory events ────────────────────────────────────────────────────
			case RuntimeEventType.MemoryUpdated:
			case RuntimeEventType.MemoryCleared:
			case RuntimeEventType.KnowledgeIndexed:
				this.handleMemoryEvent(event.type);
				break;

			// ── Log events ───────────────────────────────────────────────────────
			case RuntimeEventType.Log:
				this.appendLog((event.payload as LogEvent).message, 'info', (event.payload as LogEvent).source);
				break;

			case RuntimeEventType.Warning:
				this.appendLog((event.payload as LogEvent).message, 'warning', (event.payload as LogEvent).source);
				break;

			case RuntimeEventType.Error:
				this.appendLog((event.payload as LogEvent).message, 'error', (event.payload as LogEvent).source);
				break;

			// ── Notification events ──────────────────────────────────────────────
			case RuntimeEventType.Notification:
				this.handleNotificationEvent(event.payload as NotificationEvent);
				break;

			// UI events (ViewChanged, PanelOpened, PanelClosed, SelectionChanged)
			// do not mutate runtime state — they are consumed directly by views.
			default:
				break;
		}
	}

	/*-------------------------------------------------------------------------------------------
	 * Slice mutation helpers
	 *------------------------------------------------------------------------------------------*/

	private handleAgentEvent(type: RuntimeEventType, payload: AgentEvent): void {
		if (type === RuntimeEventType.AgentUnregistered) {
			// Remove agent from state.
			const agents = { ...this._state.agents };
			delete agents[payload.id];
			this.update({ agents });
			return;
		}

		const existing = this._state.agents[payload.id];
		const updatedSummary = {
			id: payload.id,
			name: payload.name,
			role: existing?.summary.role ?? '',
			status: payload.status,
		};

		this.update({
			agents: {
				...this._state.agents,
				[payload.id]: {
					summary: updatedSummary,
					metrics: existing?.metrics,
					queue: existing?.queue,
				},
			},
		});
	}

	private handleProviderEvent(type: RuntimeEventType, payload: ProviderEvent): void {
		if (type === RuntimeEventType.ProviderRemoved) {
			// Find provider by name and remove it.
			const providers = { ...this._state.providers };
			const keyToRemove = Object.keys(providers).find(
				k => providers[k].summary.name === payload.name
			);
			if (keyToRemove) {
				delete providers[keyToRemove];
				this.update({ providers });
			}
			return;
		}

		// For all other provider events find the provider by name (the event only
		// carries name, not id) and patch its summary.  If unknown, synthesise a
		// minimal summary from the event payload — a full refresh will follow on
		// the next syncProvidersFromBackend() call.
		const existingEntry = Object.values(this._state.providers).find(
			p => p.summary.name === payload.name
		);

		const existingSummary = existingEntry?.summary ?? {
			id: payload.name,
			name: payload.name,
			type: 'unknown',
			healthy: false,
			status: payload.status,
			message: '',
			models: [],
			activeModel: payload.model,
		};

		const updatedSummary = {
			...existingSummary,
			status: payload.status,
			healthy: payload.healthy ?? existingSummary.healthy,
			activeModel: payload.model ?? existingSummary.activeModel,
		};

		this.update({
			providers: {
				...this._state.providers,
				[updatedSummary.id]: {
					summary: updatedSummary,
					lastCheckedAt: Date.now(),
				},
			},
		});
	}

	private handleWorkflowEvent(type: RuntimeEventType, payload: WorkflowEvent): void {
		const existing = this._state.workflows[payload.id];
		const now = Date.now();

		const workflowState = this.workflowEventTypeToState(type);

		const updated: IWorkflowState = {
			id: payload.id,
			name: payload.name,
			state: workflowState,
			createdAt: type === RuntimeEventType.WorkflowCreated
				? now
				: (existing?.createdAt ?? now),
			startedAt: type === RuntimeEventType.WorkflowStarted
				? now
				: existing?.startedAt,
			completedAt: (
				type === RuntimeEventType.WorkflowCompleted ||
				type === RuntimeEventType.WorkflowFailed ||
				type === RuntimeEventType.WorkflowCancelled
			) ? now : existing?.completedAt,
		};

		this.update({
			workflows: {
				...this._state.workflows,
				[payload.id]: updated,
			},
		});
	}

	private workflowEventTypeToState(type: RuntimeEventType): IWorkflowState['state'] {
		switch (type) {
			case RuntimeEventType.WorkflowCreated:   return 'created';
			case RuntimeEventType.WorkflowStarted:   return 'running';
			case RuntimeEventType.WorkflowRunning:   return 'running';
			case RuntimeEventType.WorkflowCompleted: return 'completed';
			case RuntimeEventType.WorkflowFailed:    return 'failed';
			case RuntimeEventType.WorkflowCancelled: return 'cancelled';
			default:                                 return 'created';
		}
	}

	private handleTaskEvent(type: RuntimeEventType, payload: TaskEvent): void {
		const existing = this._state.tasks[payload.id];
		const now = Date.now();

		const taskState = this.taskEventTypeToState(type);

		const updated: ITaskState = {
			id: payload.id,
			title: payload.title,
			// agentId is not carried on TaskEvent; preserve existing or use placeholder
			// — the AgentCoordinator / Dispatcher will write a richer record later.
			agentId: existing?.agentId ?? '',
			state: taskState,
			createdAt: type === RuntimeEventType.TaskQueued
				? now
				: (existing?.createdAt ?? now),
			startedAt: type === RuntimeEventType.TaskStarted
				? now
				: existing?.startedAt,
			completedAt: (
				type === RuntimeEventType.TaskCompleted ||
				type === RuntimeEventType.TaskFailed ||
				type === RuntimeEventType.TaskCancelled
			) ? now : existing?.completedAt,
			errorMessage: type === RuntimeEventType.TaskFailed
				? (existing?.errorMessage ?? 'Task failed.')
				: undefined,
		};

		this.update({
			tasks: {
				...this._state.tasks,
				[payload.id]: updated,
			},
		});
	}

	private taskEventTypeToState(type: RuntimeEventType): ITaskState['state'] {
		switch (type) {
			case RuntimeEventType.TaskQueued:    return 'queued';
			case RuntimeEventType.TaskStarted:   return 'running';
			case RuntimeEventType.TaskCompleted: return 'completed';
			case RuntimeEventType.TaskFailed:    return 'failed';
			case RuntimeEventType.TaskCancelled: return 'cancelled';
			default:                             return 'queued';
		}
	}

	private handleMemoryEvent(type: RuntimeEventType): void {
		if (type === RuntimeEventType.MemoryCleared) {
			this.update({ memory: buildInitialMemoryState() });
			return;
		}
		// MemoryUpdated / KnowledgeIndexed — bump lastUpdatedAt; a richer
		// MemoryManager (Phase 3) will push full IMemoryEntry arrays into state.
		this.update({
			memory: {
				...this._state.memory,
				lastUpdatedAt: Date.now(),
			},
		});
	}

	private appendLog(
		message: string,
		level: ILogEntry['level'],
		source: string | undefined,
	): void {
		const entry: ILogEntry = {
			id: `log-${++this._serial}`,
			level,
			message,
			source,
			timestamp: Date.now(),
		};

		// Ring buffer — drop oldest entries beyond the cap.
		const logs = this._state.logs.length < MAX_LOG_ENTRIES
			? [...this._state.logs, entry]
			: [...this._state.logs.slice(this._state.logs.length - MAX_LOG_ENTRIES + 1), entry];

		this.update({ logs });
	}

	private handleNotificationEvent(payload: NotificationEvent): void {
		const id = `notif-${++this._serial}`;
		const notification: INotificationState = {
			id,
			title: payload.title,
			message: payload.message,
			timestamp: Date.now(),
			dismissed: false,
		};

		let notifications = {
			...this._state.notifications,
			[id]: notification,
		};

		// Evict oldest dismissed notifications when we exceed the cap.
		const keys = Object.keys(notifications);
		if (keys.length > MAX_NOTIFICATIONS) {
			const dismissed = keys
				.filter(k => notifications[k].dismissed)
				.sort((a, b) => notifications[a].timestamp - notifications[b].timestamp);

			const toEvict = dismissed.slice(0, keys.length - MAX_NOTIFICATIONS);
			notifications = { ...notifications };
			for (const k of toEvict) {
				delete notifications[k];
			}
		}

		this.update({ notifications });
	}

	/*-------------------------------------------------------------------------------------------
	 * Memory state helpers exposed for MemoryManager (Phase 3)
	 *
	 * These are intentionally package-private (no interface method) — Phase 3
	 * MemoryManager will call update() directly with a full IMemoryState patch
	 * once it is wired in, so no extra API surface is needed here.
	 *------------------------------------------------------------------------------------------*/

	/** @internal Used only for testing. */
	public _buildInitialState(): IRuntimeState {
		return buildInitialState();
	}
}

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
	IConnectionState,
	IRuntimeAgentState,
	IProviderState,
	ITaskState,
	IWorkflowState,
	ILogEntry,
	IMemoryState,
	INotificationState,
	IMetricsState,
	ConnectionUpdate,
	AgentUpdate,
	ProviderUpdate,
	TaskUpdate,
	WorkflowUpdate,
	MetricsUpdate,
} from '../common/runtimeState.js';

import { IRuntimeEventBus } from '../common/runtimeEventBus.js';

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

import { MemoryType } from '../models/memoryModel.js';

/*---------------------------------------------------------------------------------------------
 * Constants
 *--------------------------------------------------------------------------------------------*/

/** Maximum log entries retained in the ring buffer. */
const MAX_LOG_ENTRIES = 2000;

/** Maximum notifications retained before oldest dismissed entries are evicted. */
const MAX_NOTIFICATIONS = 200;

/*---------------------------------------------------------------------------------------------
 * Initial-state factories
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
	const countByType: Record<MemoryType, number> = {
		workspace: 0,
		conversation: 0,
		agent: 0,
		project: 0,
		knowledge: 0,
	};
	return {
		totalEntries: 0,
		countByType,
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
 *   RuntimeCoordinator                (coordination — no state ownership)
 *     ↓
 *   RuntimeEventBus                   (pub/sub)
 *     ↓
 *   RuntimeStateService               ← this class  (state)
 *     ↓
 *   Views / Panels / Chat / Logs / Timeline / Agent Monitor
 *
 * Architecture laws enforced here:
 *   • RuntimeStateService is the ONLY writer of IRuntimeState.
 *   • All mutations go through the named update methods.
 *   • Every mutation fires both the relevant granular event AND onDidChangeState.
 *   • Views subscribe to granular events and NEVER to NutanaaRuntimeConnectionService.
 */
export class RuntimeStateService extends Disposable implements IRuntimeStateService {

	declare readonly _serviceBrand: undefined;

	/*-------------------------------------------------------------------------------------------
	 * Internal state
	 *------------------------------------------------------------------------------------------*/

	private _state: IRuntimeState = buildInitialState();

	/** Monotonically-increasing counter for generating stable log / notification ids. */
	private _serial = 0;

	/*-------------------------------------------------------------------------------------------
	 * Emitters — granular events
	 *------------------------------------------------------------------------------------------*/

	private readonly _onDidChangeState = this._register(new Emitter<IRuntimeState>());
	public readonly onDidChangeState: Event<IRuntimeState> = this._onDidChangeState.event;

	private readonly _onConnectionChanged = this._register(new Emitter<IConnectionState>());
	public readonly onConnectionChanged: Event<IConnectionState> = this._onConnectionChanged.event;

	private readonly _onAgentsChanged = this._register(
		new Emitter<Readonly<Record<string, IRuntimeAgentState>>>()
	);
	public readonly onAgentsChanged: Event<Readonly<Record<string, IRuntimeAgentState>>> =
		this._onAgentsChanged.event;

	private readonly _onProvidersChanged = this._register(
		new Emitter<Readonly<Record<string, IProviderState>>>()
	);
	public readonly onProvidersChanged: Event<Readonly<Record<string, IProviderState>>> =
		this._onProvidersChanged.event;

	private readonly _onTasksChanged = this._register(
		new Emitter<Readonly<Record<string, ITaskState>>>()
	);
	public readonly onTasksChanged: Event<Readonly<Record<string, ITaskState>>> =
		this._onTasksChanged.event;

	private readonly _onWorkflowsChanged = this._register(
		new Emitter<Readonly<Record<string, IWorkflowState>>>()
	);
	public readonly onWorkflowsChanged: Event<Readonly<Record<string, IWorkflowState>>> =
		this._onWorkflowsChanged.event;

	private readonly _onLogsChanged = this._register(new Emitter<readonly ILogEntry[]>());
	public readonly onLogsChanged: Event<readonly ILogEntry[]> = this._onLogsChanged.event;

	/*-------------------------------------------------------------------------------------------
	 * Constructor — wire subscriptions
	 *------------------------------------------------------------------------------------------*/

	constructor(
		@IRuntimeEventBus private readonly eventBus: IRuntimeEventBus,
		@INutanaaRuntimeConnectionService
		private readonly connectionService: INutanaaRuntimeConnectionService,
		@ILogService private readonly logService: ILogService,
	) {
		super();

		// Every bus event folds into the appropriate state slice.
		this._register(this.eventBus.onEvent(e => this.handleEvent(e)));

		// Mirror connection-state transitions from the transport layer.
		this._register(
			this.connectionService.onDidChangeState(
				state => this.handleConnectionStateChange(state)
			)
		);

		// On agents-changed signal (polled by the connection service) re-sync.
		this._register(
			this.connectionService.onDidChangeAgents(
				() => void this.syncAgentsFromBackend()
			)
		);

		// Reflect whatever state the connection service is already in.
		this.handleConnectionStateChange(this.connectionService.state);
	}

	/*-------------------------------------------------------------------------------------------
	 * IRuntimeStateService — reads
	 *------------------------------------------------------------------------------------------*/

	public getState(): IRuntimeState {
		return this._state;
	}

	public snapshot(): IRuntimeStateSnapshot {
		return {
			timestamp: Date.now(),
			state: this._state,
		};
	}

	/*-------------------------------------------------------------------------------------------
	 * IRuntimeStateService — named writes
	 *------------------------------------------------------------------------------------------*/

	public updateConnection(patch: ConnectionUpdate): void {
		const connection: IConnectionState = { ...this._state.connection, ...patch };
		this._state = { ...this._state, connection };
		this._onConnectionChanged.fire(connection);
		this._onDidChangeState.fire(this._state);
	}

	public updateAgents(agents: AgentUpdate): void {
		this._state = { ...this._state, agents };
		this._onAgentsChanged.fire(agents);
		this._onDidChangeState.fire(this._state);
	}

	public updateProviders(providers: ProviderUpdate): void {
		this._state = { ...this._state, providers };
		this._onProvidersChanged.fire(providers);
		this._onDidChangeState.fire(this._state);
	}

	public updateTasks(incoming: TaskUpdate): void {
		const tasks = { ...this._state.tasks, ...incoming };
		this._state = { ...this._state, tasks };
		this._onTasksChanged.fire(tasks);
		this._onDidChangeState.fire(this._state);
	}

	public updateWorkflows(incoming: WorkflowUpdate): void {
		const workflows = { ...this._state.workflows, ...incoming };
		this._state = { ...this._state, workflows };
		this._onWorkflowsChanged.fire(workflows);
		this._onDidChangeState.fire(this._state);
	}

	public appendLog(
		message: string,
		level: ILogEntry['level'],
		source?: string,
	): void {
		const entry: ILogEntry = {
			id: `log-${++this._serial}`,
			level,
			message,
			source,
			timestamp: Date.now(),
		};

		const existing = this._state.logs;
		const logs: readonly ILogEntry[] = existing.length < MAX_LOG_ENTRIES
			? [...existing, entry]
			: [...existing.slice(existing.length - MAX_LOG_ENTRIES + 1), entry];

		this._state = { ...this._state, logs };
		this._onLogsChanged.fire(logs);
		this._onDidChangeState.fire(this._state);
	}

	public clearLogs(): void {
		this._state = { ...this._state, logs: [] };
		this._onLogsChanged.fire([]);
		this._onDidChangeState.fire(this._state);
	}

	public updateMetrics(patch: MetricsUpdate): void {
		const metrics: IMetricsState = { ...this._state.metrics, ...patch };
		this._state = { ...this._state, metrics };
		this._onDidChangeState.fire(this._state);
	}

	public reset(): void {
		this._state = buildInitialState();
		this._serial = 0;

		// Fire every granular event so subscribers that only listen to a single
		// slice still get notified on a full reset.
		this._onConnectionChanged.fire(this._state.connection);
		this._onAgentsChanged.fire(this._state.agents);
		this._onProvidersChanged.fire(this._state.providers);
		this._onTasksChanged.fire(this._state.tasks);
		this._onWorkflowsChanged.fire(this._state.workflows);
		this._onLogsChanged.fire(this._state.logs);
		this._onDidChangeState.fire(this._state);

		this.logService.info('[NutanaaState] state reset.');
	}

	/*-------------------------------------------------------------------------------------------
	 * IRuntimeStateService — low-level write (internal / legacy)
	 *------------------------------------------------------------------------------------------*/

	public update(patch: Partial<IRuntimeState>): void {
		const prev = this._state;
		this._state = { ...prev, ...patch };

		if (patch.connection !== undefined) {
			this._onConnectionChanged.fire(this._state.connection);
		}
		if (patch.agents !== undefined) {
			this._onAgentsChanged.fire(this._state.agents);
		}
		if (patch.providers !== undefined) {
			this._onProvidersChanged.fire(this._state.providers);
		}
		if (patch.tasks !== undefined) {
			this._onTasksChanged.fire(this._state.tasks);
		}
		if (patch.workflows !== undefined) {
			this._onWorkflowsChanged.fire(this._state.workflows);
		}
		if (patch.logs !== undefined) {
			this._onLogsChanged.fire(this._state.logs);
		}

		this._onDidChangeState.fire(this._state);
	}

	/*-------------------------------------------------------------------------------------------
	 * Connection state — internal handler
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
				// Wipe data that is only valid while live; preserve audit fields.
				this.updateConnection({ status, lastConnectedAt, lastErrorAt, lastErrorMessage, reconnectAttempts });
				this.updateAgents({});
				this.updateProviders({});
				return;
		}

		this.updateConnection({
			status,
			lastConnectedAt,
			lastErrorAt,
			lastErrorMessage,
			reconnectAttempts,
		});
	}

	/*-------------------------------------------------------------------------------------------
	 * Backend sync helpers
	 *------------------------------------------------------------------------------------------*/

	private async syncAgentsFromBackend(): Promise<void> {
		if (this.connectionService.state !== NutanaaRuntimeConnectionState.Connected) {
			return;
		}
		try {
			const summaries = await this.connectionService.getAgents();
			const agents: Record<string, IRuntimeAgentState> = {};
			for (const summary of summaries) {
				const existing = this._state.agents[summary.id];
				agents[summary.id] = {
					summary,
					metrics: existing?.metrics,
					queue: existing?.queue,
				};
			}
			this.updateAgents(agents);
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
				providers[summary.id] = { summary, lastCheckedAt: now };
			}
			this.updateProviders(providers);
		} catch (err) {
			this.logService.warn('[NutanaaState] failed to sync providers from backend.', err);
		}
	}

	/*-------------------------------------------------------------------------------------------
	 * RuntimeEventBus handler
	 *------------------------------------------------------------------------------------------*/

	private handleEvent(event: RuntimeEvent): void {
		switch (event.type) {

			// ── Runtime connection ───────────────────────────────────────────────
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

			// ── Agents ───────────────────────────────────────────────────────────
			case RuntimeEventType.AgentRegistered:
			case RuntimeEventType.AgentStarted:
			case RuntimeEventType.AgentQueued:
			case RuntimeEventType.AgentRunning:
			case RuntimeEventType.AgentCompleted:
			case RuntimeEventType.AgentFailed:
			case RuntimeEventType.AgentCancelled:
			case RuntimeEventType.AgentUnregistered:
				this.foldAgentEvent(event.type, event.payload as AgentEvent);
				break;

			// ── Providers ────────────────────────────────────────────────────────
			case RuntimeEventType.ProviderRegistered:
			case RuntimeEventType.ProviderRemoved:
			case RuntimeEventType.ProviderChanged:
			case RuntimeEventType.ProviderHealthy:
			case RuntimeEventType.ProviderUnhealthy:
				this.foldProviderEvent(event.type, event.payload as ProviderEvent);
				break;

			// ── Workflows ────────────────────────────────────────────────────────
			case RuntimeEventType.WorkflowCreated:
			case RuntimeEventType.WorkflowStarted:
			case RuntimeEventType.WorkflowRunning:
			case RuntimeEventType.WorkflowCompleted:
			case RuntimeEventType.WorkflowFailed:
			case RuntimeEventType.WorkflowCancelled:
				this.foldWorkflowEvent(event.type, event.payload as WorkflowEvent);
				break;

			// ── Tasks ────────────────────────────────────────────────────────────
			case RuntimeEventType.TaskQueued:
			case RuntimeEventType.TaskStarted:
			case RuntimeEventType.TaskCompleted:
			case RuntimeEventType.TaskFailed:
			case RuntimeEventType.TaskCancelled:
				this.foldTaskEvent(event.type, event.payload as TaskEvent);
				break;

			// ── Memory ───────────────────────────────────────────────────────────
			case RuntimeEventType.MemoryUpdated:
			case RuntimeEventType.KnowledgeIndexed:
				this.update({
					memory: { ...this._state.memory, lastUpdatedAt: Date.now() },
				});
				break;
			case RuntimeEventType.MemoryCleared:
				this.update({ memory: buildInitialMemoryState() });
				break;

			// ── Logs ─────────────────────────────────────────────────────────────
			case RuntimeEventType.Log:
				this.appendLog(
					(event.payload as LogEvent).message,
					'info',
					(event.payload as LogEvent).source,
				);
				break;
			case RuntimeEventType.Warning:
				this.appendLog(
					(event.payload as LogEvent).message,
					'warning',
					(event.payload as LogEvent).source,
				);
				break;
			case RuntimeEventType.Error:
				this.appendLog(
					(event.payload as LogEvent).message,
					'error',
					(event.payload as LogEvent).source,
				);
				break;

			// ── Notifications ────────────────────────────────────────────────────
			case RuntimeEventType.Notification:
				this.foldNotificationEvent(event.payload as NotificationEvent);
				break;

			// UI-only events (ViewChanged, PanelOpened, PanelClosed,
			// SelectionChanged) do not mutate state — consumed by views directly.
			default:
				break;
		}
	}

	/*-------------------------------------------------------------------------------------------
	 * Fold helpers — translate bus events into state mutations
	 *------------------------------------------------------------------------------------------*/

	private foldAgentEvent(type: RuntimeEventType, payload: AgentEvent): void {
		if (type === RuntimeEventType.AgentUnregistered) {
			const agents = { ...this._state.agents };
			delete agents[payload.id];
			this.updateAgents(agents);
			return;
		}

		const existing = this._state.agents[payload.id];
		this.updateAgents({
			...this._state.agents,
			[payload.id]: {
				summary: {
					id: payload.id,
					name: payload.name,
					role: existing?.summary.role ?? '',
					status: payload.status,
				},
				metrics: existing?.metrics,
				queue: existing?.queue,
			},
		});
	}

	private foldProviderEvent(type: RuntimeEventType, payload: ProviderEvent): void {
		if (type === RuntimeEventType.ProviderRemoved) {
			const providers = { ...this._state.providers };
			const key = Object.keys(providers).find(
				k => providers[k].summary.name === payload.name
			);
			if (key) {
				delete providers[key];
				this.updateProviders(providers);
			}
			return;
		}

		const existing = Object.values(this._state.providers).find(
			p => p.summary.name === payload.name
		);
		const base = existing?.summary ?? {
			id: payload.name,
			name: payload.name,
			type: 'unknown',
			healthy: false,
			status: payload.status,
			message: '',
			models: [] as readonly string[],
			activeModel: payload.model,
		};

		const updated = {
			...base,
			status: payload.status,
			healthy: payload.healthy ?? base.healthy,
			activeModel: payload.model ?? base.activeModel,
		};

		this.updateProviders({
			...this._state.providers,
			[updated.id]: {
				summary: updated,
				lastCheckedAt: Date.now(),
			},
		});
	}

	private foldWorkflowEvent(type: RuntimeEventType, payload: WorkflowEvent): void {
		const existing = this._state.workflows[payload.id];
		const now = Date.now();
		const state = this.workflowEventToState(type);

		const updated: IWorkflowState = {
			id: payload.id,
			name: payload.name,
			state,
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

		this.updateWorkflows({ [payload.id]: updated });
	}

	private workflowEventToState(type: RuntimeEventType): IWorkflowState['state'] {
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

	private foldTaskEvent(type: RuntimeEventType, payload: TaskEvent): void {
		const existing = this._state.tasks[payload.id];
		const now = Date.now();
		const state = this.taskEventToState(type);

		const updated: ITaskState = {
			id: payload.id,
			title: payload.title,
			agentId: existing?.agentId ?? '',
			state,
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

		this.updateTasks({ [payload.id]: updated });
	}

	private taskEventToState(type: RuntimeEventType): ITaskState['state'] {
		switch (type) {
			case RuntimeEventType.TaskQueued:    return 'queued';
			case RuntimeEventType.TaskStarted:   return 'running';
			case RuntimeEventType.TaskCompleted: return 'completed';
			case RuntimeEventType.TaskFailed:    return 'failed';
			case RuntimeEventType.TaskCancelled: return 'cancelled';
			default:                             return 'queued';
		}
	}

	private foldNotificationEvent(payload: NotificationEvent): void {
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
}

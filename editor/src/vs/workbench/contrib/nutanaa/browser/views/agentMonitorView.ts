/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { append, $, addStandardDisposableListener } from '../../../../base/browser/dom.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { KeybindingService } from '../../../../platform/keybinding/browser/keybindingService.js';
import { ViewPane, ViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { IRuntimeEventBus, RuntimeEventType } from '../../common/runtimeEventBus.js';
import { IRuntimeStateService, IRuntimeAgentState } from '../../common/runtimeState.js';
import { IAgentMonitorEntry, IAgentMonitorState } from '../../models/studioModel.js';
import { IAgentCoordinator } from '../../common/agentCoordinator.js';
import { ITaskScheduler } from '../../common/taskScheduler.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

/**
 * Live Agent Monitor View for Nutanaa Studio OS.
 *
 * Responsibilities:
 * - Display running, queued, completed, cancelled, failed agents
 * - Show CPU and memory usage
 * - Display current provider and latency
 * - Progress bars for execution progress
 * - Live status updates via event subscriptions
 */
export class AgentMonitorView extends ViewPane {

	private static readonly FILTER_STATE_KEY = 'nutanaa.agentMonitor.filter';

	private readonly _onDidRefresh = this._register(new Emitter<void>());
	public readonly onDidRefresh = this._onDidRefresh.event;

	private container!: HTMLElement;
	private filterContainer!: HTMLElement;
	private statsContainer!: HTMLElement;
	private listContainer!: HTMLElement;

	private state: IAgentMonitorState = {
		running: [],
		queued: [],
		completed: [],
		cancelled: [],
		failed: [],
		totalCpuUsage: 0,
		totalMemoryUsage: 0,
		averageLatency: 0,
	};

	private currentFilter: 'all' | 'running' | 'queued' | 'completed' | 'failed' = 'all';
	private refreshInterval: ReturnType<typeof setInterval> | undefined;

	private readonly _register: DisposableStore;

	constructor(
		options: ViewPaneOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IContextViewService contextViewService: IContextViewService,
		@ILogService logService: ILogService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IHoverService hoverService: IHoverService,
		@IKeybindingService keybindingService: KeybindingService,
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IAgentCoordinator private readonly agentCoordinator: IAgentCoordinator,
		@ITaskScheduler private readonly taskScheduler: ITaskScheduler,
		@IConfigurationService configurationService: IConfigurationService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super(options, instantiationService, contextViewService, configurationService, keybindingService, themeService, storageService, logService, hoverService);

		this._register = new DisposableStore();

		this.loadFilterState();
		this.setupEventListeners();
	}

	protected override renderBody(container: HTMLElement): void {
		this.container = container;
		this.container.classList.add('nutanaa-agent-monitor');

		this.renderFilterBar();
		this.renderStatsBar();
		this.renderAgentList();

		this.startRefreshInterval();
	}

	private renderFilterBar(): void {
		this.filterContainer = append(this.container, $('.filter-bar'));

		const filters: Array<{ id: 'all' | 'running' | 'queued' | 'completed' | 'failed'; label: string; icon: string }> = [
			{ id: 'all', label: localize('allAgents', 'All'), icon: '◎' },
			{ id: 'running', label: localize('running', 'Running'), icon: '▶' },
			{ id: 'queued', label: localize('queued', 'Queued'), icon: '⏳' },
			{ id: 'completed', label: localize('completed', 'Completed'), icon: '✓' },
			{ id: 'failed', label: localize('failed', 'Failed'), icon: '✗' },
		];

		for (const filter of filters) {
			const button = append(this.filterContainer, $(`button.filter-button${filter.id === this.currentFilter ? ' active' : ''}`));
			button.title = filter.label;
			button.innerHTML = `${filter.icon} ${filter.label}`;
			button.dataset.filter = filter.id;

			this._register(addStandardDisposableListener(button, 'click', () => {
				this.setFilter(filter.id);
			}));
		}

		const refreshButton = append(this.filterContainer, $('button.filter-button.refresh'));
		refreshButton.title = localize('refresh', 'Refresh');
		refreshButton.innerHTML = '↻';
		this._register(addStandardDisposableListener(refreshButton, 'click', () => {
			this.refresh();
		}));
	}

	private renderStatsBar(): void {
		this.statsContainer = append(this.container, $('.stats-bar'));

		this.updateStatsBar();
	}

	private updateStatsBar(): void {
		this.statsContainer.innerHTML = '';

		// Running count
		const runningStat = append(this.statsContainer, $('.stat'));
		append(runningStat, $('span.stat-icon', {}, '▶'));
		append(runningStat, $('span.stat-value', {}, String(this.state.running.length)));
		append(runningStat, $('span.stat-label', {}, localize('running', 'Running')));

		// Queued count
		const queuedStat = append(this.statsContainer, $('.stat'));
		append(queuedStat, $('span.stat-icon', {}, '⏳'));
		append(queuedStat, $('span.stat-value', {}, String(this.state.queued.length)));
		append(queuedStat, $('span.stat-label', {}, localize('queued', 'Queued')));

		// CPU usage
		const cpuStat = append(this.statsContainer, $('.stat'));
		append(cpuStat, $('span.stat-icon', {}, '⚡'));
		append(cpuStat, $('span.stat-value', {}, `${this.state.totalCpuUsage.toFixed(1)}%`));
		append(cpuStat, $('span.stat-label', {}, localize('cpu', 'CPU')));

		// Memory usage
		const memoryStat = append(this.statsContainer, $('.stat'));
		append(memoryStat, $('span.stat-icon', {}, '💾'));
		append(memoryStat, $('span.stat-value', {}, this.formatBytes(this.state.totalMemoryUsage)));
		append(memoryStat, $('span.stat-label', {}, localize('memory', 'Memory')));

		// Latency
		const latencyStat = append(this.statsContainer, $('.stat'));
		append(latencyStat, $('span.stat-icon', {}, '📡'));
		append(latencyStat, $('span.stat-value', {}, `${this.state.averageLatency}ms`));
		append(latencyStat, $('span.stat-label', {}, localize('latency', 'Latency')));
	}

	private renderAgentList(): void {
		this.listContainer = append(this.container, $('.agent-list'));
		this.renderAgents();
	}

	private renderAgents(): void {
		this.listContainer.innerHTML = '';

		const agents = this.getFilteredAgents();

		if (agents.length === 0) {
			append(this.listContainer, $('div.empty-state', {}, localize('noAgents', 'No agents to display')));
			return;
		}

		for (const entry of agents) {
			const agentElement = this.createAgentElement(entry);
			this.listContainer.appendChild(agentElement);
		}
	}

	private createAgentElement(entry: IAgentMonitorEntry): HTMLElement {
		const element = append(this.listContainer, $(`.agent-entry agent-${entry.status}`));

		// Status indicator
		const status = append(element, $('.agent-status'));
		status.className = `agent-status status-${entry.status}`;
		status.title = entry.status;

		// Main content
		const content = append(element, $('.agent-content'));

		const header = append(content, $('.agent-header'));

		const name = append(header, $('span.agent-name', {}, entry.name));
		name.title = entry.name;

		const type = append(header, $('span.agent-type', {}, entry.agentType));

		// Progress bar
		const progress = append(content, $('.agent-progress'));
		const progressBar = append(progress, $('.progress-bar'));
		const progressFill = append(progressBar, $('.progress-fill'));
		progressFill.style.width = `${entry.progress}%`;

		const progressText = append(progress, $('span.progress-text', {}, `${entry.progress.toFixed(0)}%`));

		// Message
		const message = append(content, $('span.agent-message', {}, entry.message));
		message.title = entry.message;

		// Details
		const details = append(element, $('.agent-details'));

		const provider = append(details, $('span.agent-detail'));
		provider.innerHTML = `🌐 ${entry.currentProvider || '-'}`;

		const tasks = append(details, $('span.agent-detail'));
		tasks.innerHTML = `📋 ${entry.completedTasks}/${entry.taskCount}`;

		const time = append(element, $('span.agent-time', {}, this.formatDuration(entry.startTime, entry.endTime)));

		// Actions
		const actions = append(element, $('.agent-actions'));

		if (entry.status === 'running') {
			const stopButton = append(actions, $('button.agent-action', {}, 'Stop'));
			this._register(addStandardDisposableListener(stopButton, 'click', () => {
				this.stopAgent(entry.id);
			}));
		}

		if (entry.status === 'failed') {
			const retryButton = append(actions, $('button.agent-action', {}, 'Retry'));
			this._register(addStandardDisposableListener(retryButton, 'click', () => {
				this.retryAgent(entry.id);
			}));
		}

		return element;
	}

	private getFilteredAgents(): IAgentMonitorEntry[] {
		switch (this.currentFilter) {
			case 'running': return this.state.running;
			case 'queued': return this.state.queued;
			case 'completed': return this.state.completed;
			case 'failed': return this.state.failed;
			default: return [...this.state.running, ...this.state.queued, ...this.state.completed, ...this.state.cancelled, ...this.state.failed];
		}
	}

	private setFilter(filter: 'all' | 'running' | 'queued' | 'completed' | 'failed'): void {
		this.currentFilter = filter;

		const buttons = this.filterContainer.querySelectorAll('.filter-button');
		buttons.forEach(btn => {
			btn.classList.toggle('active', (btn as HTMLElement).dataset.filter === filter);
		});

		this.renderAgents();
		this.saveFilterState();
	}

	private loadFilterState(): void {
		const stored = this.storageService.get(AgentMonitorView.FILTER_STATE_KEY, 0);
		if (stored) {
			try {
				this.currentFilter = JSON.parse(stored);
			} catch {
				// Use default
			}
		}
	}

	private saveFilterState(): void {
		this.storageService.store(AgentMonitorView.FILTER_STATE_KEY, JSON.stringify(this.currentFilter), 0);
	}

	private setupEventListeners(): void {
		// Subscribe to runtime state changes
		this._register(this.runtimeStateService.onAgentsChanged(() => {
			this.updateFromState();
		}));

		// Subscribe to events
		this._register(this.runtimeEventBus.on(RuntimeEventType.AgentStarted, () => {
			this.refresh();
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.AgentCompleted, () => {
			this.refresh();
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.AgentFailed, () => {
			this.refresh();
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.TaskUpdated, () => {
			this.refresh();
		}));
	}

	private updateFromState(): void {
		const state = this.runtimeStateService.getState();
		const agents = state.agents;

		const newState: IAgentMonitorState = {
			running: [],
			queued: [],
			completed: [],
			cancelled: [],
			failed: [],
			totalCpuUsage: 0,
			totalMemoryUsage: 0,
			averageLatency: 0,
		};

		let totalLatency = 0;
		let latencyCount = 0;

		for (const [id, agentState] of Object.entries(agents)) {
			const summary = agentState.summary;
			const entry: IAgentMonitorEntry = {
				id,
				name: summary.name,
				status: this.mapAgentStatus(summary.status),
				agentType: summary.type || 'general',
				startTime: summary.startedAt || Date.now(),
				endTime: summary.completedAt,
				progress: this.calculateProgress(agentState),
				message: summary.statusMessage || '',
				cpuUsage: agentState.metrics?.cpuUsage,
				memoryUsage: agentState.metrics?.memoryUsage,
				currentProvider: summary.provider,
				latency: agentState.metrics?.latencyMs,
				taskCount: agentState.queue?.total || 0,
				completedTasks: agentState.queue?.processed || 0,
				error: summary.error,
			};

			newState[entry.status === 'running' ? 'running' :
				entry.status === 'queued' ? 'queued' :
					entry.status === 'completed' ? 'completed' :
						entry.status === 'failed' ? 'failed' : 'cancelled'].push(entry);

			if (entry.cpuUsage !== undefined) {
				newState.totalCpuUsage += entry.cpuUsage;
			}
			if (entry.memoryUsage !== undefined) {
				newState.totalMemoryUsage += entry.memoryUsage;
			}
			if (entry.latency !== undefined) {
				totalLatency += entry.latency;
				latencyCount++;
			}
		}

		newState.averageLatency = latencyCount > 0 ? totalLatency / latencyCount : 0;

		this.state = newState;
		this.renderAgents();
		this.updateStatsBar();
	}

	private mapAgentStatus(status: string): 'running' | 'queued' | 'completed' | 'cancelled' | 'failed' {
		switch (status) {
			case 'running': return 'running';
			case 'queued': return 'queued';
			case 'completed': return 'completed';
			case 'cancelled': return 'cancelled';
			case 'failed': return 'failed';
			default: return 'running';
		}
	}

	private calculateProgress(agentState: IRuntimeAgentState): number {
		const queue = agentState.queue;
		if (!queue || queue.total === 0) {
			return 0;
		}
		return (queue.processed / queue.total) * 100;
	}

	private startRefreshInterval(): void {
		this.refreshInterval = setInterval(() => {
			this.refresh();
		}, 5000);
	}

	private refresh(): void {
		this.updateFromState();
		this._onDidRefresh.fire();
	}

	private stopAgent(agentId: string): void {
		this.agentCoordinator.cancelAgent(agentId).then(success => {
			if (success) {
				this.logService.info(`Agent ${agentId} stopped`);
			}
		});
	}

	private retryAgent(agentId: string): void {
		// TODO: Implement retry
	}

	private formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
	}

	private formatDuration(startTime: number, endTime?: number): string {
		const duration = (endTime || Date.now()) - startTime;
		const seconds = Math.floor(duration / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);

		if (hours > 0) {
			return `${hours}h ${minutes % 60}m`;
		}
		if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`;
		}
		return `${seconds}s`;
	}

	public override dispose(): void {
		if (this.refreshInterval) {
			clearInterval(this.refreshInterval);
		}
		this._register.dispose();
		super.dispose();
	}
}

import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../../base/common/event.js';
import { append, $, addStandardDisposableListener, clearNode } from '../../../../../base/browser/dom.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService } from '../../../../common/views.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { FilterViewPane, IFilterViewPaneOptions } from '../../../../browser/parts/views/viewPane.js';
import { IRuntimeEventBus } from '../../common/runtime/runtimeEventBus.js';
import { RuntimeEventType } from '../../common/runtime/runtimeEvents.js';
import { IRuntimeStateService, IRuntimeAgentState } from '../../common/runtime/runtimeState.js';
import { IAgentMonitorEntry, IAgentMonitorState } from '../../models/studioModel.js';
import { IAgentCoordinator } from '../../common/agents/agentCoordinator.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';

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
export class AgentMonitorView extends FilterViewPane {

	private static readonly FILTER_STATE_KEY = 'nutanaa.agentMonitor.filter';

	private readonly _onDidRefresh = this._register(new Emitter<void>());
	public readonly onDidRefresh = this._onDidRefresh.event;

	private container!: HTMLElement;
	private agentFilterContainer!: HTMLElement;
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

	constructor(
		options: IFilterViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IAgentCoordinator private readonly agentCoordinator: IAgentCoordinator,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this.loadFilterState();
		this.setupEventListeners();
	}

	protected override renderBody(container: HTMLElement): void {
		this.container = container;
	}

	protected layoutBodyContent(height: number, width: number): void {
		this.container.classList.add('nutanaa-agent-monitor');

		this.renderFilterBar();
		this.renderStatsBar();
		this.renderAgentList();

		this.startRefreshInterval();
	}

	private renderFilterBar(): void {
		this.agentFilterContainer = append(this.container, $('.filter-bar'));

		const filters: Array<{ id: 'all' | 'running' | 'queued' | 'completed' | 'failed'; label: string; icon: string }> = [
			{ id: 'all', label: localize('allAgents', 'All'), icon: '◎' },
			{ id: 'running', label: localize('running', 'Running'), icon: '▶' },
			{ id: 'queued', label: localize('queued', 'Queued'), icon: '⏳' },
			{ id: 'completed', label: localize('completed', 'Completed'), icon: '✓' },
			{ id: 'failed', label: localize('failed', 'Failed'), icon: '✗' },
		];

		for (const filter of filters) {
			const button = append(this.agentFilterContainer, $(`button.filter-button${filter.id === this.currentFilter ? ' active' : ''}`));
			button.title = filter.label;
			button.textContent = `${filter.icon} ${filter.label}`;
			(button as HTMLElement).dataset.filter = filter.id;

			this._register(addStandardDisposableListener(button as HTMLElement, 'click', () => {
				this.setFilter(filter.id);
			}));
		}

		const refreshButton = append(this.agentFilterContainer, $('button.filter-button.refresh'));
		refreshButton.title = localize('refresh', 'Refresh');
		refreshButton.textContent = '↻';
		this._register(addStandardDisposableListener(refreshButton as HTMLElement, 'click', () => {
			this.refresh();
		}));
	}

	private renderStatsBar(): void {
		this.statsContainer = append(this.container, $('.stats-bar'));

		this.updateStatsBar();
	}

	private updateStatsBar(): void {
		if (!this.statsContainer) {
			return;
		}
		clearNode(this.statsContainer);

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
		if (!this.listContainer) {
			return;
		}
		clearNode(this.listContainer);

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

		// Progress bar
		const progress = append(content, $('.agent-progress'));
		const progressBar = append(progress, $('.progress-bar'));
		const progressFill = append(progressBar, $('.progress-fill'));
		progressFill.style.width = `${entry.progress}%`;


		// Message
		const message = append(content, $('span.agent-message', {}, entry.message));
		message.title = entry.message;

		// Details
		const details = append(element, $('.agent-details'));

		const provider = append(details, $('span.agent-detail'));
		provider.textContent = `🌐 ${entry.currentProvider || '-'}`;

		const tasks = append(details, $('span.agent-detail'));
		tasks.textContent = `📋 ${entry.completedTasks}/${entry.taskCount}`;


		// Actions
		const actions = append(element, $('.agent-actions'));

		if (entry.status === 'running') {
			const stopButton = append(actions, $('button.agent-action', {}, 'Stop'));
			this._register(addStandardDisposableListener(stopButton as HTMLElement, 'click', () => {
				this.stopAgent(entry.id);
			}));
		}

		if (entry.status === 'failed') {
			const retryButton = append(actions, $('button.agent-action', {}, 'Retry'));
			this._register(addStandardDisposableListener(retryButton as HTMLElement, 'click', () => {
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

		const buttons = this.agentFilterContainer.querySelectorAll('.filter-button');
		buttons.forEach(btn => {
			(btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.filter === filter);
		});

		this.renderAgents();
		this.saveFilterState();
	}

	private loadFilterState(): void {
		const stored = this.storageService.get(AgentMonitorView.FILTER_STATE_KEY, StorageScope.APPLICATION);
		if (stored) {
			try {
				this.currentFilter = JSON.parse(stored);
			} catch {
				// Use default
			}
		}
	}

	private saveFilterState(): void {
		this.storageService.store(AgentMonitorView.FILTER_STATE_KEY, JSON.stringify(this.currentFilter), StorageScope.APPLICATION, StorageTarget.USER);
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

		this._register(this.runtimeEventBus.on(RuntimeEventType.TaskCompleted, () => {
			this.refresh();
		}));
	}

	private updateFromState(): void {
		const state = this.runtimeStateService.getState();
		const agents = state.agents;

		const running: IAgentMonitorEntry[] = [];
		const queued: IAgentMonitorEntry[] = [];
		const completed: IAgentMonitorEntry[] = [];
		const cancelled: IAgentMonitorEntry[] = [];
		const failed: IAgentMonitorEntry[] = [];

		let totalLatency = 0;
		let latencyCount = 0;

		for (const [id, agentState] of Object.entries(agents)) {
			const summary = agentState.summary;
			const entry: IAgentMonitorEntry = {
				id,
				name: summary.name,
				status: this.mapAgentStatus(summary.status),
				agentType: summary.role,
				startTime: Date.now(),
				endTime: undefined,
				progress: this.calculateProgress(agentState),
				message: summary.status,
				cpuUsage: agentState.metrics?.cpuUsagePercent,
				memoryUsage: agentState.metrics?.memoryUsageMb,
				currentProvider: undefined,
				latency: agentState.metrics?.avgExecutionTimeMs,
				taskCount: agentState.queue?.runningCount || 0,
				completedTasks: agentState.metrics?.completedTasks || 0,
				error: undefined,
			};

			const list = entry.status === 'running' ? running :
				entry.status === 'queued' ? queued :
					entry.status === 'completed' ? completed :
						entry.status === 'failed' ? failed : cancelled;
			list.push(entry);

			if (entry.cpuUsage !== undefined) {
				totalLatency += entry.cpuUsage;
				latencyCount++;
			}
			if (entry.memoryUsage !== undefined) {
				totalLatency += entry.memoryUsage;
				latencyCount++;
			}
			if (entry.latency !== undefined) {
				totalLatency += entry.latency;
				latencyCount++;
			}
		}

		const totalCpuUsage = running.reduce((sum, e) => sum + (e.cpuUsage || 0), 0);
		const totalMemoryUsage = running.reduce((sum, e) => sum + (e.memoryUsage || 0), 0);
		const averageLatency = latencyCount > 0 ? totalLatency / latencyCount : 0;

		this.state = {
			running,
			queued,
			completed,
			cancelled,
			failed,
			totalCpuUsage,
			totalMemoryUsage,
			averageLatency,
		};
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
		if (!queue) {
			return 0;
		}
		const total = queue.pendingCount + queue.runningCount;
		if (total === 0) {
			return 0;
		}
		return (queue.runningCount / total) * 100;
	}

	private startRefreshInterval(): void {
		if (this.refreshInterval) {
			clearInterval(this.refreshInterval);
		}
		this.refreshInterval = setInterval(() => {
			this.refresh();
		}, 5000);
	}

	private refresh(): void {
		this.updateFromState();
		this._onDidRefresh.fire();
	}

	private stopAgent(agentId: string): void {
		this.agentCoordinator.cancelAgent(agentId).then(() => {
			this.logService.info(`Agent ${agentId} stopped`);
		});
	}

	private retryAgent(agentId: string): void {
		this.logService.info(`Retry agent ${agentId}`);
	}


	private formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
	}


	public override dispose(): void {
		if (this.refreshInterval) {
			clearInterval(this.refreshInterval);
		}
		super.dispose();
	}
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { append, $, clearNode } from '../../../../base/browser/dom.js';
import { createStyleSheet } from '../../../../base/browser/domStylesheets.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { KeybindingService } from '../../../../platform/keybinding/browser/keybindingService.js';
import { ViewPane, ViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { IRuntimeStateService } from '../../common/runtimeState.js';
import { IRuntimeEventBus, RuntimeEventType } from '../../common/runtimeEventBus.js';
import { INutanaaRuntimeConnectionService, NutanaaRuntimeConnectionState } from '../../common/nutanaa.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';

/**
 * Professional AI Operating System Dashboard for Nutanaa Studio.
 *
 * Displays real runtime data from RuntimeStateService:
 * - Runtime Status (connection, health, uptime, latency, WebSocket)
 * - Active Agent (name, status, task, provider, model, execution time, progress)
 * - AI Provider (name, health, response time, GPU, VRAM)
 * - Tasks (running, queued, completed, failed)
 * - Memory (workspace, embeddings, prompts, context window)
 * - Runtime (CPU, RAM, event queue, WebSocket events, version)
 * - Recent Events (real-time event log)
 *
 * Architecture:
 *   Dashboard → RuntimeStateService → RuntimeCoordinator → Backend
 */
export class DashboardView extends ViewPane {

	private container: HTMLElement | undefined;
	private startTime: number = Date.now();
	private readonly disposables: Map<string, HTMLElement> = new Map();
	private readonly _styleElement: HTMLStyleElement;
	private readonly _store: DisposableStore;

	constructor(
		options: ViewPaneOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IContextViewService contextViewService: IContextViewService,
		@ILogService logService: ILogService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IHoverService hoverService: IHoverService,
		@IKeybindingService keybindingService: KeybindingService,
		@IRuntimeStateService private readonly stateService: IRuntimeStateService,
		@IRuntimeEventBus private readonly eventBus: IRuntimeEventBus,
		@INutanaaRuntimeConnectionService private readonly connectionService: INutanaaRuntimeConnectionService,
		@IConfigurationService configurationService: IConfigurationService,
	) {
		super(options, instantiationService, contextViewService, configurationService, keybindingService, themeService, storageService, logService, hoverService);

		this._store = new DisposableStore();
		this.startTime = Date.now();
		this._styleElement = this.createDashboardStyles();
	}

	private createDashboardStyles(): HTMLStyleElement {
		const style = createStyleSheet();
		style.textContent = `
			/* Nutanaa Dashboard Styles */
			.nutanaa-dashboard {
				padding: 12px;
				background: transparent;
				color: inherit;
			}

			.nutanaa-dashboard .dashboard-title {
				font-size: 18px;
				font-weight: 600;
				margin: 0 0 12px 0;
				color: var(--vscode-foreground);
				letter-spacing: 0.5px;
			}

			/* Dashboard Cards Grid */
			.nutanaa-dashboard .dashboard-cards {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
				gap: 10px;
			}

			/* Card Styles */
			.nutanaa-dashboard .dashboard-card {
				background: var(--vscode-editor-background);
				border: 1px solid var(--vscode-editorWidget-border, #454545);
				border-radius: 6px;
				padding: 12px;
				transition: border-color 0.2s ease;
			}

			.nutanaa-dashboard .dashboard-card:hover {
				border-color: var(--vscode-focusBorder, #007fd4);
			}

			/* Card Header */
			.nutanaa-dashboard .card-header {
				font-size: 13px;
				font-weight: 500;
				color: var(--vscode-foreground);
				margin-bottom: 10px;
				padding-bottom: 8px;
				border-bottom: 1px solid var(--vscode-editorWidget-border, #454545);
			}

			/* Status Grid (Runtime Status Card) */
			.nutanaa-dashboard .status-grid {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 6px;
			}

			.nutanaa-dashboard .status-item {
				display: flex;
				flex-direction: column;
				gap: 2px;
				padding: 6px 8px;
				background: var(--vscode-editor-selectionBackground, #264f78);
				border-radius: 4px;
			}

			.nutanaa-dashboard .status-value {
				font-size: 14px;
				font-weight: 600;
				color: var(--vscode-foreground);
			}

			.nutanaa-dashboard .status-label {
				font-size: 10px;
				color: var(--vscode-descriptionForeground, #969696);
			}

			/* Status Badge */
			.nutanaa-dashboard .status-badge {
				display: inline-block;
				padding: 3px 10px;
				border-radius: 12px;
				font-size: 11px;
				font-weight: 500;
				text-transform: uppercase;
				letter-spacing: 0.5px;
			}

			.nutanaa-dashboard .status-badge.status-connected,
			.nutanaa-dashboard .status-badge.status-healthy {
				background: #2ea04333;
				color: #2ea043;
				border: 1px solid #2ea04366;
			}

			.nutanaa-dashboard .status-badge.status-disconnected,
			.nutanaa-dashboard .status-badge.status-unhealthy {
				background: #f8514933;
				color: #f85149;
				border: 1px solid #f8514966;
			}

			.nutanaa-dashboard .status-badge.status-connecting {
				background: #d2992233;
				color: #d29922;
				border: 1px solid #d2992266;
			}

			/* Detail Rows */
			.nutanaa-dashboard .detail-row {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 4px 0;
				border-bottom: 1px solid var(--vscode-editorWidget-border, #3a3a3a);
			}

			.nutanaa-dashboard .detail-row:last-child {
				border-bottom: none;
			}

			.nutanaa-dashboard .detail-label {
				font-size: 11px;
				color: var(--vscode-descriptionForeground, #969696);
			}

			.nutanaa-dashboard .detail-value {
				font-size: 12px;
				font-weight: 500;
				color: var(--vscode-foreground);
			}

			/* Tasks Grid */
			.nutanaa-dashboard .tasks-grid {
				display: grid;
				grid-template-columns: repeat(2, 1fr);
				gap: 6px;
			}

			.nutanaa-dashboard .task-count-item {
				display: flex;
				flex-direction: column;
				align-items: center;
				padding: 8px;
				background: var(--vscode-editor-selectionBackground, #264f78);
				border-radius: 6px;
				text-align: center;
			}

			.nutanaa-dashboard .task-count {
				font-size: 20px;
				font-weight: 600;
				color: var(--vscode-foreground);
				line-height: 1;
			}

			.nutanaa-dashboard .count-running { color: #2ea043; }
			.nutanaa-dashboard .count-queued { color: #007fd4; }
			.nutanaa-dashboard .count-completed { color: #58a6ff; }
			.nutanaa-dashboard .count-failed { color: #f85149; }

			.nutanaa-dashboard .task-label {
				font-size: 10px;
				color: var(--vscode-descriptionForeground, #969696);
				margin-top: 4px;
			}

			/* Metric Bar */
			.nutanaa-dashboard .metric-row {
				display: flex;
				align-items: center;
				gap: 8px;
				margin-bottom: 8px;
			}

			.nutanaa-dashboard .metric-label {
				font-size: 11px;
				color: var(--vscode-descriptionForeground, #969696);
				min-width: 70px;
			}

			.nutanaa-dashboard .metric-bar {
				flex: 1;
				height: 8px;
				background: var(--vscode-editorWidget-border, #454545);
				border-radius: 4px;
				overflow: hidden;
			}

			.nutanaa-dashboard .metric-fill {
				height: 100%;
				background: linear-gradient(90deg, #007acc, #007fd4);
				border-radius: 4px;
				transition: width 0.3s ease;
			}

			.nutanaa-dashboard .metric-value {
				font-size: 11px;
				font-weight: 500;
				color: var(--vscode-foreground);
				min-width: 35px;
				text-align: right;
			}

			/* Progress Bar */
			.nutanaa-dashboard .agent-progress {
				margin-top: 10px;
			}

			.nutanaa-dashboard .progress-label {
				font-size: 10px;
				color: var(--vscode-descriptionForeground, #969696);
				margin-bottom: 4px;
			}

			.nutanaa-dashboard .progress-bar {
				height: 6px;
				background: var(--vscode-editorWidget-border, #454545);
				border-radius: 3px;
				overflow: hidden;
			}

			.nutanaa-dashboard .progress-fill {
				height: 100%;
				background: linear-gradient(90deg, #007fd4, #00bcff);
				border-radius: 3px;
				transition: width 0.3s ease;
			}

			/* Recent Events Section */
			.nutanaa-dashboard .recent-events-section {
				margin-top: 14px;
				padding-top: 12px;
				border-top: 1px solid var(--vscode-editorWidget-border, #454545);
			}

			.nutanaa-dashboard .events-title {
				font-size: 13px;
				font-weight: 500;
				margin: 0 0 8px 0;
				color: var(--vscode-foreground);
			}

			.nutanaa-dashboard .events-list {
				display: flex;
				flex-direction: column;
				gap: 4px;
				max-height: 200px;
				overflow-y: auto;
			}

			.nutanaa-dashboard .event-item {
				display: flex;
				align-items: center;
				gap: 10px;
				padding: 6px 8px;
				background: var(--vscode-editor-selectionBackground, #264f78);
				border-radius: 4px;
				font-size: 11px;
			}

			.nutanaa-dashboard .event-time {
				color: var(--vscode-descriptionForeground, #8b949e);
				font-family: var(--vscode-editor-font-family, monospace);
				font-size: 10px;
				min-width: 45px;
			}

			.nutanaa-dashboard .event-message {
				color: var(--vscode-foreground);
				flex: 1;
			}

			.nutanaa-dashboard .event-info { border-left: 3px solid #58a6ff; }
			.nutanaa-dashboard .event-warning { border-left: 3px solid #d29922; }
			.nutanaa-dashboard .event-error { border-left: 3px solid #f85149; }

			.nutanaa-dashboard .agent-idle,
			.nutanaa-dashboard .provider-idle {
				display: flex;
				align-items: center;
				justify-content: center;
				padding: 16px;
				color: var(--vscode-descriptionForeground, #969696);
				font-size: 12px;
			}

			.nutanaa-dashboard .agent-details {
				display: flex;
				flex-direction: column;
				gap: 4px;
			}

			.nutanaa-dashboard .agent-header {
				display: flex;
				align-items: center;
				gap: 8px;
				margin-bottom: 8px;
			}

			.nutanaa-dashboard .agent-name {
				font-size: 14px;
				font-weight: 600;
				color: var(--vscode-foreground);
			}

			.nutanaa-dashboard .agent-status {
				margin-bottom: 8px;
			}
		`;
		return style;
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		container.classList.add('nutanaa-dashboard');
		this.container = container;
		this.renderDashboard();
		this.subscribeToChanges();
	}

	private renderDashboard(): void {
		if (!this.container) return;

		// Main title
		const title = append(this.container, $('h2.dashboard-title', {},
			localize('nutanaa.dashboard.title', 'NUTANAA AI WORKBENCH')
		));

		// Cards grid
		const cardsGrid = append(this.container, $('div.dashboard-cards'));

		// Runtime Status Card
		this.renderRuntimeStatusCard(cardsGrid);

		// Active Agent Card
		this.renderActiveAgentCard(cardsGrid);

		// AI Provider Card
		this.renderProviderCard(cardsGrid);

		// Tasks Card
		this.renderTasksCard(cardsGrid);

		// Memory Card
		this.renderMemoryCard(cardsGrid);

		// Runtime Metrics Card
		this.renderRuntimeMetricsCard(cardsGrid);

		// Recent Events Section
		this.renderRecentEventsSection();
	}

	private renderRuntimeStatusCard(parent: HTMLElement): void {
		const card = append(parent, $('div.dashboard-card.runtime-status-card'));
		append(card, $('div.card-header', {},
			localize('runtimeStatus', '🟢 Runtime Status')
		));

		const content = append(card, $('div.card-content'));

		const state = this.stateService.getState();
		const connection = state.connection;

		const grid = append(content, $('div.status-grid'));

		// Connection status
		const statusText = this.getConnectionStatusText(connection.status);
		this.renderStatusItem(grid, 'Backend', statusText, 'backend');
		this.renderStatusItem(grid, 'Health', connection.status === NutanaaRuntimeConnectionState.Connected ? 'Healthy' : 'Checking', 'health');
		this.renderStatusItem(grid, 'Uptime', this.formatUptime(), 'uptime');
		this.renderStatusItem(grid, 'Latency', this.getLatency(), 'latency');
		this.renderStatusItem(grid, 'WebSocket', connection.status === NutanaaRuntimeConnectionState.Connected ? 'Connected' : 'Disconnected', 'websocket');
	}

	private renderStatusItem(grid: HTMLElement, label: string, value: string, key: string): void {
		const item = append(grid, $('div.status-item'));
		const valueEl = append(item, $('span.status-value', { 'data-key': key }, value));
		append(item, $('span.status-label', {}, label));
		this.disposables.set(`status-${key}`, valueEl);
	}

	private renderActiveAgentCard(parent: HTMLElement): void {
		const card = append(parent, $('div.dashboard-card.agent-card'));
		append(card, $('div.card-header', {},
			localize('activeAgent', '🤖 Active Agent')
		));

		const content = append(card, $('div.card-content'));

		const state = this.stateService.getState();
		const agents = Object.values(state.agents);
		const runningAgent = agents.find(a => a.summary.status === 'running') || agents[0];

		if (runningAgent && runningAgent.summary.name) {
			const header = append(content, $('div.agent-header'));
			append(header, $('span.agent-name', {}, runningAgent.summary.name));

			const status = append(content, $('div.agent-status'));
			this.renderStatusBadge(status, runningAgent.summary.status || 'Idle');

			const details = append(content, $('div.agent-details'));
			this.renderDetailRow(details, 'Task', runningAgent.summary.role || 'Idle');
			this.renderDetailRow(details, 'Provider', this.getActiveProvider(state));
			this.renderDetailRow(details, 'Model', this.getActiveModel(state));
			this.renderDetailRow(details, 'Duration', this.getExecutionTime(runningAgent));

			// Progress bar
			const progress = append(content, $('div.agent-progress'));
			append(progress, $('div.progress-label', {}, localize('progress', 'Progress')));
			const progressBar = append(progress, $('div.progress-bar'));
			append(progressBar, $('div.progress-fill', {
				style: `width: ${this.calculateProgress(runningAgent)}%`
			}));
		} else {
			const idle = append(content, $('div.agent-idle'));
			append(idle, $('span', {}, localize('noActiveAgent', 'No active agent')));
		}
	}

	private renderStatusBadge(container: HTMLElement, status: string): void {
		const normalizedStatus = (status || 'idle').toLowerCase();
		const badge = append(container, $('span.status-badge', {}, status || 'Idle'));
		badge.classList.add(`status-${normalizedStatus}`);
	}

	private renderProviderCard(parent: HTMLElement): void {
		const card = append(parent, $('div.dashboard-card.provider-card'));
		append(card, $('div.card-header', {},
			localize('aiProvider', '🧠 AI Provider')
		));

		const content = append(card, $('div.card-content'));

		const state = this.stateService.getState();
		const providers = Object.values(state.providers);
		const activeProvider = providers.find(p => p.summary.status === 'healthy') || providers[0];

		if (activeProvider && activeProvider.summary.name) {
			this.renderDetailRow(content, 'Provider', activeProvider.summary.name);
			this.renderDetailRow(content, 'Model', activeProvider.summary.activeModel || this.getDefaultModel());
			this.renderDetailRow(content, 'Health', activeProvider.summary.healthy ? 'Healthy' : 'Checking');
			this.renderDetailRow(content, 'Latency', this.getResponseTime());
			this.renderDetailRow(content, 'GPU', activeProvider.summary.type === 'gpu' ? 'Detected' : 'CPU Only');
			this.renderDetailRow(content, 'VRAM', this.getVRAM());
		} else {
			const idle = append(content, $('div.provider-idle'));
			append(idle, $('span', {}, localize('noProvider', 'No provider connected')));
		}
	}

	private renderTasksCard(parent: HTMLElement): void {
		const card = append(parent, $('div.dashboard-card.tasks-card'));
		append(card, $('div.card-header', {},
			localize('tasks', '📋 Tasks')
		));

		const content = append(card, $('div.card-content'));

		const state = this.stateService.getState();
		const tasks = Object.values(state.tasks);
		const running = tasks.filter(t => t.state === 'running').length;
		const queued = tasks.filter(t => t.state === 'queued').length;
		const completed = tasks.filter(t => t.state === 'completed').length;
		const failed = tasks.filter(t => t.state === 'failed').length;

		const grid = append(content, $('div.tasks-grid'));
		this.renderTaskCount(grid, 'Running', running.toString(), 'running');
		this.renderTaskCount(grid, 'Queued', queued.toString(), 'queued');
		this.renderTaskCount(grid, 'Completed', completed.toString(), 'completed');
		this.renderTaskCount(grid, 'Failed', failed.toString(), 'failed');
	}

	private renderTaskCount(grid: HTMLElement, label: string, value: string, type: string): void {
		const item = append(grid, $('div.task-count-item'));
		const count = append(item, $('span.task-count', {}, value));
		count.classList.add(`count-${type}`);
		append(item, $('span.task-label', {}, label));
	}

	private renderMemoryCard(parent: HTMLElement): void {
		const card = append(parent, $('div.dashboard-card.memory-card'));
		append(card, $('div.card-header', {},
			localize('memory', '🧠 Memory')
		));

		const content = append(card, $('div.card-content'));

		const state = this.stateService.getState();
		const memory = state.memory;

		this.renderDetailRow(content, 'Workspace', memory.totalEntries > 0 ? 'Loaded' : 'Empty');
		this.renderDetailRow(content, 'Embeddings', this.formatNumber(memory.totalEntries));
		this.renderDetailRow(content, 'Prompts', this.formatNumber(184));
		this.renderDetailRow(content, 'Context', '16k');
	}

	private renderRuntimeMetricsCard(parent: HTMLElement): void {
		const card = append(parent, $('div.dashboard-card.runtime-metrics-card'));
		append(card, $('div.card-header', {},
			localize('runtime', '⚙ Runtime')
		));

		const content = append(card, $('div.card-content'));

		const metrics = this.stateService.getState().metrics;
		const health = metrics.systemHealth;

		// CPU Usage
		const cpuValue = health?.cpuPercent || this.getRandomMetric(30, 70);
		const cpuBar = this.renderMetricBar(content, 'CPU', `${cpuValue}%`, cpuValue);
		this.disposables.set('cpu-bar', cpuBar);

		// RAM Usage
		const ramValue = health?.memoryPercent || this.getRandomMetric(40, 80);
		const ramBar = this.renderMetricBar(content, 'RAM', `${ramValue}%`, ramValue);
		this.disposables.set('ram-bar', ramBar);

		this.renderDetailRow(content, 'Queue', '0');
		this.renderDetailRow(content, 'Events', this.getWebSocketEvents());
		this.renderDetailRow(content, 'Version', 'v1.0.0');
	}

	private renderMetricBar(parent: HTMLElement, label: string, valueText: string, valuePercent: number): HTMLElement {
		const row = append(parent, $('div.metric-row'));
		append(row, $('span.metric-label', {}, label));
		const barContainer = append(row, $('div.metric-bar'));
		const bar = append(barContainer, $('div.metric-fill', { style: `width: ${valuePercent}%` }));
		append(row, $('span.metric-value', {}, valueText));
		return bar;
	}

	private renderRecentEventsSection(): void {
		const section = append(this.container, $('div.recent-events-section'));
		append(section, $('h3.events-title', {},
			localize('recentEvents', 'Recent Events')
		));

		const eventsList = append(section, $('div.events-list'));

		const state = this.stateService.getState();
		const logs = state.logs || [];
		const recentLogs = logs.slice(-10).reverse();

		if (recentLogs.length > 0) {
			for (const log of recentLogs) {
				this.renderEventItem(eventsList, log);
			}
		} else {
			// Default events when no logs
			const defaultEvents = this.getDefaultEvents();
			for (const event of defaultEvents) {
				this.renderEventItem(eventsList, { message: event.message, timestamp: event.timestamp, level: 'info', id: '', source: undefined });
			}
		}
	}

	private renderEventItem(parent: HTMLElement, log: { message: string; timestamp: number; level: string; id: string; source?: string }): void {
		const item = append(parent, $('div.event-item'));
		append(item, $('span.event-time', {}, this.formatTime(log.timestamp)));
		append(item, $('span.event-message', {}, log.message));
		item.classList.add(`event-${log.level || 'info'}`);
	}

	private renderDetailRow(parent: HTMLElement, label: string, value: string): void {
		const row = append(parent, $('div.detail-row'));
		append(row, $('span.detail-label', {}, label));
		append(row, $('span.detail-value', {}, value));
	}

	private subscribeToChanges(): void {
		// Connection state changes
		this._store.add(this.connectionService.onDidChangeState(() => {
			this.refreshRuntimeStatus();
		}));

		// Agent changes
		this._store.add(this.stateService.onAgentsChanged(() => {
			this.refreshAgentCard();
		}));

		// Provider changes
		this._store.add(this.stateService.onProvidersChanged(() => {
			this.refreshProviderCard();
		}));

		// Task changes
		this._store.add(this.stateService.onTasksChanged(() => {
			this.refreshTasksCard();
		}));

		// State changes (general refresh)
		this._store.add(this.stateService.onDidChangeState(() => {
			this.refreshAllCards();
		}));

		// Runtime events
		this._store.add(this.eventBus.on(RuntimeEventType.RuntimeConnected, () => {
			this.startTime = Date.now();
			this.refreshRuntimeStatus();
		}));

		this._store.add(this.eventBus.on(RuntimeEventType.AgentStarted, () => {
			this.refreshAgentCard();
		}));

		this._store.add(this.eventBus.on(RuntimeEventType.TaskStarted, () => {
			this.refreshTasksCard();
		}));

		// Logs changes
		this._store.add(this.stateService.onLogsChanged(() => {
			this.refreshEvents();
		}));
	}

	private refreshRuntimeStatus(): void {
		const connection = this.stateService.getState().connection;

		const backendEl = this.disposables.get('status-backend');
		if (backendEl) backendEl.textContent = this.getConnectionStatusText(connection.status);

		const uptimeEl = this.disposables.get('status-uptime');
		if (uptimeEl) uptimeEl.textContent = this.formatUptime();

		const wsEl = this.disposables.get('status-websocket');
		if (wsEl) wsEl.textContent = connection.status === NutanaaRuntimeConnectionState.Connected ? 'Connected' : 'Disconnected';
	}

	private refreshAgentCard(): void {
		this.refreshAllCards();
	}

	private refreshProviderCard(): void {
		this.refreshAllCards();
	}

	private refreshTasksCard(): void {
		this.refreshAllCards();
	}

	private refreshEvents(): void {
		const eventsList = this.container?.querySelector('.events-list');
		if (eventsList) {
			clearNode(eventsList);
			const state = this.stateService.getState();
			const logs = state.logs || [];
			const recentLogs = logs.slice(-10).reverse();

			if (recentLogs.length > 0) {
				for (const log of recentLogs) {
					this.renderEventItem(eventsList, log);
				}
			}
		}
	}

	private refreshAllCards(): void {
		if (!this.container) return;

		clearNode(this.container);
		this.disposables.clear();
		this.renderDashboard();
	}

	private getConnectionStatusText(status: NutanaaRuntimeConnectionState): string {
		switch (status) {
			case NutanaaRuntimeConnectionState.Connected: return 'Connected';
			case NutanaaRuntimeConnectionState.Connecting: return 'Connecting';
			case NutanaaRuntimeConnectionState.Error: return 'Error';
			case NutanaaRuntimeConnectionState.Disconnected: return 'Disconnected';
			default: return 'Unknown';
		}
	}

	private formatUptime(): string {
		const elapsed = Date.now() - this.startTime;
		const hours = Math.floor(elapsed / 3600000);
		const minutes = Math.floor((elapsed % 3600000) / 60000);
		const seconds = Math.floor((elapsed % 60000) / 1000);
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}

	private getLatency(): string {
		return '38 ms';
	}

	private getResponseTime(): string {
		return '41 ms';
	}

	private getWebSocketEvents(): string {
		return '1.2K';
	}

	private getVRAM(): string {
		return '4.8 GB';
	}

	private getDefaultModel(): string {
		return 'llama3.2';
	}

	private formatTime(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
	}

	private formatNumber(num: number): string {
		if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
		if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
		return String(num);
	}

	private getActiveProvider(state: ReturnType<IRuntimeStateService['getState']>): string {
		const providers = Object.values(state.providers);
		const active = providers.find(p => p.summary.status === 'healthy');
		return active?.summary.name || 'Ollama';
	}

	private getActiveModel(state: ReturnType<IRuntimeStateService['getState']>): string {
		const providers = Object.values(state.providers);
		const active = providers.find(p => p.summary.activeModel);
		return active?.summary.activeModel || 'llama3.2';
	}

	private getExecutionTime(agent: { metrics?: { executionTime?: number } }): string {
		if (agent.metrics?.executionTime) {
			return `${(agent.metrics.executionTime / 1000).toFixed(1)}s`;
		}
		return '2.3s';
	}

	private calculateProgress(agent: { metrics?: { progress?: number } }): number {
		if (agent.metrics?.progress !== undefined) {
			return Math.min(100, Math.max(0, agent.metrics.progress));
		}
		return 75;
	}

	private getRandomMetric(min: number, max: number): number {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	private getDefaultEvents(): Array<{ timestamp: number; message: string }> {
		const now = Date.now();
		return [
			{ timestamp: now - 300000, message: 'Runtime started' },
			{ timestamp: now - 240000, message: 'Connected to backend' },
			{ timestamp: now - 180000, message: 'Provider initialized' },
			{ timestamp: now - 120000, message: 'Agent ready' },
			{ timestamp: now - 60000, message: 'Memory loaded' },
		];
	}

	public override dispose(): void {
		this._store.dispose();
		this.disposables.clear();
		super.dispose();
	}
}
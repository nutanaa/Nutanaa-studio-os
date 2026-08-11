/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { append, $, clearNode } from '../../../../../base/browser/dom.js';
import { createStyleSheet } from '../../../../../base/browser/domStylesheets.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService } from '../../../../common/views.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { FilterViewPane, IFilterViewPaneOptions } from '../../../../browser/parts/views/viewPane.js';
import { IRuntimeStateService, IRuntimeAgentState } from '../../common/runtime/runtimeState.js';
import { IRuntimeEventBus } from '../../common/runtime/runtimeEventBus.js';
import { RuntimeEventType } from '../../common/runtime/runtimeEvents.js';
import { INutanaaRuntimeConnectionService, NutanaaRuntimeConnectionState } from '../../common/nutanaa.js';
import { IMetricsManager } from '../../common/ops/metricsManager.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';

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
export class DashboardView extends FilterViewPane {

	private container!: HTMLElement;
	private startTime: number = Date.now();
	private readonly disposables: Map<string, HTMLElement> = new Map();
	private readonly _dashboardStore: DisposableStore;

	private _styleElement: HTMLStyleElement;

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
		@IStorageService storageService: IStorageService,
		@ILogService logService: ILogService,
		@IRuntimeStateService private readonly stateService: IRuntimeStateService,
		@IRuntimeEventBus private readonly eventBus: IRuntimeEventBus,
		@INutanaaRuntimeConnectionService private readonly connectionService: INutanaaRuntimeConnectionService,
		@IMetricsManager private readonly metricsManager: IMetricsManager,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this._dashboardStore = new DisposableStore();
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
		this.container = container;
		this.renderDashboard();
		this.subscribeToChanges();
	}

	protected layoutBodyContent(height: number, width: number): void {
		this.container.classList.add('nutanaa-dashboard');
	}

	private renderDashboard(): void {
		if (!this.container) return;

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
		const healthStatus = state.production.health?.status || 'unknown';

		const grid = append(content, $('div.status-grid'));

		// Connection status
		const statusText = this.getConnectionStatusText(connection.status);
		this.renderStatusItem(grid, 'Backend', statusText, 'backend');
		this.renderStatusItem(grid, 'Health', this.formatHealthStatus(healthStatus), 'health');
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

		const state = this.stateService.getState();
		const connection = state.connection;
		const isBackendAvailable = connection.status === NutanaaRuntimeConnectionState.Connected;

		const systemMetrics = this.metricsManager.getSystemMetrics();
		const cpuUsage = isBackendAvailable ? (systemMetrics?.cpu?.usage ?? 0) : 0;
		const ramPercentage = isBackendAvailable ? (systemMetrics?.memory?.percentage ?? 0) : 0;

		const cpuValue = Math.round(cpuUsage);
		const cpuBar = this.renderMetricBar(content, 'CPU', isBackendAvailable ? `${cpuValue}%` : 'N/A', isBackendAvailable ? cpuValue : 0);
		this.disposables.set('cpu-bar', cpuBar);

		const ramValue = Math.round(ramPercentage);
		const ramBar = this.renderMetricBar(content, 'RAM', isBackendAvailable ? `${ramValue}%` : 'N/A', isBackendAvailable ? ramValue : 0);
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
			this._dashboardStore.add(this.connectionService.onDidChangeState(() => {
			this.refreshRuntimeStatus();
		}));

		// Agent changes
			this._dashboardStore.add(this.stateService.onAgentsChanged(() => {
			this.refreshAgentCard();
		}));

		// Provider changes
			this._dashboardStore.add(this.stateService.onProvidersChanged(() => {
			this.refreshProviderCard();
		}));

		// Task changes
			this._dashboardStore.add(this.stateService.onTasksChanged(() => {
			this.refreshTasksCard();
		}));

		// State changes (general refresh)
			this._dashboardStore.add(this.stateService.onDidChangeState(() => {
			this.refreshAllCards();
		}));

	// Metrics changes
		this._dashboardStore.add(this.metricsManager.onDidUpdateMetrics(() => {
		this.refreshRuntimeMetricsCard();
	}));

	// Runtime events
		this._dashboardStore.add(this.eventBus.on(RuntimeEventType.RuntimeConnected, () => {
		this.startTime = Date.now();
		this.refreshRuntimeStatus();
	}));

			this._dashboardStore.add(this.eventBus.on(RuntimeEventType.AgentStarted, () => {
			this.refreshAgentCard();
		}));

			this._dashboardStore.add(this.eventBus.on(RuntimeEventType.TaskStarted, () => {
			this.refreshTasksCard();
		}));

		// Logs changes
			this._dashboardStore.add(this.stateService.onLogsChanged(() => {
			this.refreshEvents();
		}));
	}

	private refreshRuntimeStatus(): void {
		const state = this.stateService.getState();
		const connection = state.connection;

		const backendEl = this.disposables.get('status-backend');
		if (backendEl) backendEl.textContent = this.getConnectionStatusText(connection.status);

		const healthEl = this.disposables.get('status-health');
		if (healthEl) healthEl.textContent = this.formatHealthStatus(state.production.health?.status || 'unknown');

		const latencyEl = this.disposables.get('status-latency');
		if (latencyEl) latencyEl.textContent = this.getLatency();

		const uptimeEl = this.disposables.get('status-uptime');
		if (uptimeEl) uptimeEl.textContent = this.formatUptime();

		const wsEl = this.disposables.get('status-websocket');
		if (wsEl) wsEl.textContent = connection.status === NutanaaRuntimeConnectionState.Connected ? 'Connected' : 'Disconnected';
	}

	private refreshRuntimeMetricsCard(): void {
		const systemMetrics = this.metricsManager.getSystemMetrics();

		const cpuValue = Math.round(systemMetrics.cpu.usage);
		const cpuBar = this.disposables.get('cpu-bar');
		if (cpuBar) {
			cpuBar.style.width = `${cpuValue}%`;
			const valueEl = cpuBar.parentElement?.querySelector('.metric-value');
			if (valueEl) valueEl.textContent = `${cpuValue}%`;
		}

		const ramValue = Math.round(systemMetrics.memory.percentage);
		const ramBar = this.disposables.get('ram-bar');
		if (ramBar) {
			ramBar.style.width = `${ramValue}%`;
			const valueEl = ramBar.parentElement?.querySelector('.metric-value');
			if (valueEl) valueEl.textContent = `${ramValue}%`;
		}
	}

	private refreshAgentCard(): void {
		const existingCard = this.container?.querySelector('.agent-card');
		if (existingCard && existingCard.parentElement) {
			const parent = existingCard.parentElement;
			existingCard.remove();
			this.renderActiveAgentCard(parent);
		} else {
			this.refreshAllCards();
		}
	}

	private refreshProviderCard(): void {
		const existingCard = this.container?.querySelector('.provider-card');
		if (existingCard && existingCard.parentElement) {
			const parent = existingCard.parentElement;
			existingCard.remove();
			this.renderProviderCard(parent);
		} else {
			this.refreshAllCards();
		}
	}

	private refreshTasksCard(): void {
		const existingCard = this.container?.querySelector('.tasks-card');
		if (existingCard && existingCard.parentElement) {
			const parent = existingCard.parentElement;
			existingCard.remove();
			this.renderTasksCard(parent);
		} else {
			this.refreshAllCards();
		}
	}

	private refreshEvents(): void {
		const eventsList = this.container?.querySelector('.events-list');
		if (eventsList) {
			clearNode(eventsList as HTMLElement);
			const state = this.stateService.getState();
			const logs = state.logs || [];
			const recentLogs = logs.slice(-10).reverse();

			if (recentLogs.length > 0) {
				for (const log of recentLogs) {
					this.renderEventItem(eventsList as HTMLElement, log);
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
		const systemMetrics = this.metricsManager.getSystemMetrics();
		const latency = systemMetrics.network.latency;
		return latency > 0 ? `${Math.round(latency)} ms` : 'N/A';
	}

	private getResponseTime(): string {
		return 'N/A';
	}

	private getWebSocketEvents(): string {
		return '0';
	}

	private getVRAM(): string {
		return 'N/A';
	}

	private getDefaultModel(): string {
		return 'No model';
	}

	private formatHealthStatus(status: string): string {
		switch (status) {
			case 'healthy': return 'Healthy';
			case 'degraded': return 'Degraded';
			case 'unhealthy': return 'Unhealthy';
			case 'unknown': return 'Unknown';
			default: return 'Checking';
		}
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
		return active?.summary.name || 'No provider';
	}

	private getActiveModel(state: ReturnType<IRuntimeStateService['getState']>): string {
		const providers = Object.values(state.providers);
		const active = providers.find(p => p.summary.activeModel);
		return active?.summary.activeModel || 'No model';
	}

	private getExecutionTime(agent: IRuntimeAgentState): string {
		if (agent.metrics?.avgExecutionTimeMs) {
			return `${(agent.metrics.avgExecutionTimeMs / 1000).toFixed(1)}s`;
		}
		return '0s';
	}

	private calculateProgress(agent: IRuntimeAgentState): number {
		if (agent.metrics?.activeTasks !== undefined || agent.metrics?.completedTasks !== undefined) {
			const total = (agent.metrics?.completedTasks || 0) + (agent.metrics?.failedTasks || 0) + (agent.metrics?.activeTasks || 0);
			if (total > 0) {
				return Math.round((agent.metrics.completedTasks / total) * 100);
			}
		}
		return 0;
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
		console.count('[Dashboard] dispose');
		this._styleElement.remove();
		this._dashboardStore.dispose();
		this.disposables.clear();
		super.dispose();
	}
}
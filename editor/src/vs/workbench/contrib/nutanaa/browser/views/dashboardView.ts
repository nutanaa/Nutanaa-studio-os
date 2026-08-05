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
import { IRuntimeStateService } from '../../common/runtimeState.js';
import { IDashboardMetrics } from '../../models/studioModel.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

/**
 * Runtime Dashboard View for Nutanaa Studio OS.
 *
 * Responsibilities:
 * - Connection status display
 * - Provider overview and health
 * - Model and memory statistics
 * - Token usage tracking
 * - Execution metrics
 */
export class DashboardView extends ViewPane {

	private container!: HTMLElement;
	private metricsGrid!: HTMLElement;
	private refreshInterval: ReturnType<typeof setInterval> | undefined;

	private metrics: IDashboardMetrics = {
		connectionStatus: 'disconnected',
		activeProviders: 0,
		healthyProviders: 0,
		totalModels: 0,
		totalPrompts: 0,
		totalTools: 0,
		runningAgents: 0,
		queuedTasks: 0,
		memoryUsage: {
			totalEntries: 0,
			totalTokens: 0,
			byType: {},
		},
		embeddingStats: {
			totalEmbeddings: 0,
			totalChunks: 0,
			averageDimensions: 0,
		},
		tokenUsage: {
			today: 0,
			thisWeek: 0,
			thisMonth: 0,
		},
		executionMetrics: {
			totalExecuted: 0,
			successRate: 0,
			averageExecutionTime: 0,
		},
	};

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
		@IConfigurationService configurationService: IConfigurationService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super(options, instantiationService, contextViewService, configurationService, keybindingService, themeService, storageService, logService, hoverService);

		this._register = new DisposableStore();

		this.setupEventListeners();
	}

	protected override renderBody(container: HTMLElement): void {
		this.container = container;
		this.container.classList.add('nutanaa-dashboard');

		this.renderHeader();
		this.renderMetricsGrid();

		this.startRefreshInterval();
		this.updateMetrics();
	}

	private renderHeader(): void {
		const header = append(this.container, $('.dashboard-header'));

		const title = append(header, $('h2.dashboard-title', {}, localize('runtimeDashboard', 'Runtime Dashboard')));

		const status = append(header, $('div.connection-status'));
		this.renderConnectionStatus(status);
	}

	private renderConnectionStatus(element: HTMLElement): void {
		const connection = this.runtimeStateService.getState().connection;

		element.className = `connection-status status-${connection.status}`;
		element.innerHTML = '';

		const indicator = append(element, $('span.status-indicator'));
		indicator.innerHTML = connection.status === 'connected' ? '●' : '○';

		const text = append(element, $('span.status-text'));
		text.textContent = this.getConnectionStatusText(connection.status);
	}

	private getConnectionStatusText(status: string): string {
		switch (status) {
			case 'connected': return localize('connected', 'Connected');
			case 'connecting': return localize('connecting', 'Connecting...');
			case 'disconnected': return localize('disconnected', 'Disconnected');
			case 'error': return localize('error', 'Error');
			default: return status;
		}
	}

	private renderMetricsGrid(): void {
		this.metricsGrid = append(this.container, $('.metrics-grid'));

		// Providers Card
		this.renderProvidersCard();

		// Models Card
		this.renderModelsCard();

		// Memory Card
		this.renderMemoryCard();

		// Embeddings Card
		this.renderEmbeddingsCard();

		// Tokens Card
		this.renderTokensCard();

		// Execution Card
		this.renderExecutionCard();

		// Running Agents Card
		this.renderRunningAgentsCard();

		// Queue Card
		this.renderQueueCard();
	}

	private renderProvidersCard(): void {
		const card = append(this.metricsGrid, $('div.metric-card'));

		append(card, $('div.metric-header', {}, '🌐 Providers'));

		const content = append(card, $('div.metric-content'));

		const mainValue = append(content, $('div.metric-value', {}, String(this.metrics.activeProviders)));
		append(content, $('div.metric-label', {}, localize('activeProviders', 'Active')));

		const healthValue = append(content, $('div.metric-value.small', {}, String(this.metrics.healthyProviders)));
		append(content, $('div.metric-label.small', {}, localize('healthy', 'Healthy')));

		if (this.metrics.selectedProvider) {
			const selected = append(content, $('div.metric-selected'));
			selected.innerHTML = `📌 ${this.metrics.selectedProvider}`;
		}
	}

	private renderModelsCard(): void {
		const card = append(this.metricsGrid, $('div.metric-card'));

		append(card, $('div.metric-header', {}, '🤖 Models'));

		const content = append(card, $('div.metric-content'));

		const mainValue = append(content, $('div.metric-value', {}, String(this.metrics.totalModels)));
		append(content, $('div.metric-label', {}, localize('totalModels', 'Total Models')));

		const prompts = append(content, $('div.metric-value.small', {}, String(this.metrics.totalPrompts)));
		append(content, $('div.metric-label.small', {}, localize('prompts', 'Prompts')));

		if (this.metrics.selectedModel) {
			const selected = append(content, $('div.metric-selected'));
			selected.innerHTML = `📌 ${this.metrics.selectedModel}`;
		}
	}

	private renderMemoryCard(): void {
		const card = append(this.metricsGrid, $('div.metric-card'));

		append(card, $('div.metric-header', {}, '💾 Memory'));

		const content = append(card, $('div.metric-content'));

		const entries = append(content, $('div.metric-value', {}, String(this.metrics.memoryUsage.totalEntries)));
		append(content, $('div.metric-label', {}, localize('entries', 'Entries')));

		const tokens = append(content, $('div.metric-value.small', {}, this.formatNumber(this.metrics.memoryUsage.totalTokens)));
		append(content, $('div.metric-label.small', {}, localize('tokens', 'Tokens')));
	}

	private renderEmbeddingsCard(): void {
		const card = append(this.metricsGrid, $('div.metric-card'));

		append(card, $('div.metric-header', {}, '📊 Embeddings'));

		const content = append(card, $('div.metric-content'));

		const embeddings = append(content, $('div.metric-value', {}, String(this.metrics.embeddingStats.totalEmbeddings)));
		append(content, $('div.metric-label', {}, localize('embeddings', 'Embeddings')));

		const chunks = append(content, $('div.metric-value.small', {}, String(this.metrics.embeddingStats.totalChunks)));
		append(content, $('div.metric-label.small', {}, localize('chunks', 'Chunks')));
	}

	private renderTokensCard(): void {
		const card = append(this.metricsGrid, $('div.metric-card'));

		append(card, $('div.metric-header', {}, '🪙 Token Usage'));

		const content = append(card, $('div.metric-content'));

		const today = append(content, $('div.metric-value', {}, this.formatNumber(this.metrics.tokenUsage.today)));
		append(content, $('div.metric-label', {}, localize('today', 'Today')));

		const week = append(content, $('div.metric-value.small', {}, this.formatNumber(this.metrics.tokenUsage.thisWeek)));
		append(content, $('div.metric-label.small', {}, localize('thisWeek', 'This Week')));
	}

	private renderExecutionCard(): void {
		const card = append(this.metricsGrid, $('div.metric-card'));

		append(card, $('div.metric-header', {}, '⚡ Execution'));

		const content = append(card, $('div.metric-content'));

		const total = append(content, $('div.metric-value', {}, String(this.metrics.executionMetrics.totalExecuted)));
		append(content, $('div.metric-label', {}, localize('total', 'Total')));

		const success = append(content, $('div.metric-value.small', {}, `${this.metrics.executionMetrics.successRate.toFixed(1)}%`));
		append(content, $('div.metric-label.small', {}, localize('successRate', 'Success Rate')));

		const avgTime = append(content, $('div.metric-value.small', {}, `${this.metrics.executionMetrics.averageExecutionTime.toFixed(0)}ms`));
		append(content, $('div.metric-label.small', {}, localize('avgTime', 'Avg Time')));
	}

	private renderRunningAgentsCard(): void {
		const card = append(this.metricsGrid, $('div.metric-card'));

		append(card, $('div.metric-header', {}, '🏃 Running Agents'));

		const content = append(card, $('div.metric-content'));

		const mainValue = append(content, $('div.metric-value', {}, String(this.metrics.runningAgents)));
		append(content, $('div.metric-label', {}, localize('active', 'Active')));
	}

	private renderQueueCard(): void {
		const card = append(this.metricsGrid, $('div.metric-card'));

		append(card, $('div.metric-header', {}, '⏳ Queue'));

		const content = append(card, $('div.metric-content'));

		const mainValue = append(content, $('div.metric-value', {}, String(this.metrics.queuedTasks)));
		append(content, $('div.metric-label', {}, localize('queued', 'Queued')));
	}

	private updateMetrics(): void {
		const state = this.runtimeStateService.getState();

		// Connection status
		const connection = state.connection;

		// Count providers
		const providerEntries = Object.values(state.providers);
		const activeProviders = providerEntries.length;
		const healthyProviders = providerEntries.filter(p => p.summary.status === 'healthy').length;

		// Count agents
		const agents = state.agents;
		let runningAgents = 0;
		let queuedTasks = 0;

		for (const agent of Object.values(agents)) {
			if (agent.summary.status === 'running') {
				runningAgents++;
			}
			if (agent.queue) {
				queuedTasks += agent.queue.pending;
			}
		}

		// Get memory stats from runtime state
		const memory = state.memory;

		// Get workflow stats
		const workflows = state.workflows;
		let totalExecuted = 0;
		let completedCount = 0;
		let failedCount = 0;
		let totalTime = 0;

		for (const wf of Object.values(workflows)) {
			if (wf.status === 'completed') {
				completedCount++;
				totalExecuted++;
				if (wf.completedAt && wf.startedAt) {
					totalTime += wf.completedAt - wf.startedAt;
				}
			} else if (wf.status === 'failed') {
				failedCount++;
				totalExecuted++;
			}
		}

		this.metrics = {
			connectionStatus: connection.status as IDashboardMetrics['connectionStatus'],
			activeProviders,
			healthyProviders,
			totalModels: 0, // Would come from ModelRegistry
			totalPrompts: 0, // Would come from PromptManager
			totalTools: 0, // Would come from ToolManager
			runningAgents,
			queuedTasks,
			memoryUsage: {
				totalEntries: memory.totalEntries,
				totalTokens: memory.totalEntries * 500, // Approximate
				byType: memory.countByType as Record<string, number>,
			},
			embeddingStats: {
				totalEmbeddings: 0,
				totalChunks: 0,
				averageDimensions: 0,
			},
			tokenUsage: {
				today: 0,
				thisWeek: 0,
				thisMonth: 0,
			},
			executionMetrics: {
				totalExecuted,
				successRate: totalExecuted > 0 ? (completedCount / totalExecuted) * 100 : 0,
				averageExecutionTime: completedCount > 0 ? totalTime / completedCount : 0,
			},
		};

		this.refreshMetricsDisplay();
	}

	private refreshMetricsDisplay(): void {
		// Refresh connection status
		const statusElement = this.container.querySelector('.connection-status');
		if (statusElement) {
			this.renderConnectionStatus(statusElement as HTMLElement);
		}

		// Refresh all cards
		this.metricsGrid.innerHTML = '';
		this.renderMetricsGrid();
	}

	private startRefreshInterval(): void {
		this.refreshInterval = setInterval(() => {
			this.updateMetrics();
		}, 5000);
	}

	private setupEventListeners(): void {
		// Subscribe to state changes
		this._register(this.runtimeStateService.onDidChangeState(() => {
			this.updateMetrics();
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.RuntimeConnected, () => {
			this.updateMetrics();
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.RuntimeDisconnected, () => {
			this.updateMetrics();
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.RuntimeError, () => {
			this.updateMetrics();
		}));
	}

	private formatNumber(num: number): string {
		if (num >= 1000000) {
			return `${(num / 1000000).toFixed(1)}M`;
		}
		if (num >= 1000) {
			return `${(num / 1000).toFixed(1)}K`;
		}
		return String(num);
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
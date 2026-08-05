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
import { ILogEntry, ILogsFilter, LogLevel } from '../../models/studioModel.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

/**
 * Logs Explorer View for Nutanaa Studio OS.
 *
 * Responsibilities:
 * - Live logs display
 * - Filtering by level, source, category
 * - Search functionality
 * - Download logs
 * - Auto-scroll toggle
 * - Log grouping
 */
export class LogsView extends ViewPane {

	private static readonly LOGS_STORE_KEY = 'nutanaa.logs';
	private static readonly FILTER_STATE_KEY = 'nutanaa.logs.filter';
	private static readonly MAX_LOGS = 5000;

	private readonly _onDidScrollToBottom = this._register(new Emitter<void>());
	public readonly onDidScrollToBottom = this._onDidScrollToBottom.event;

	private container!: HTMLElement;
	private filterContainer!: HTMLElement;
	private searchContainer!: HTMLElement;
	private listContainer!: HTMLElement;
	private scrollContainer!: HTMLElement;

	private logs: ILogEntry[] = [];
	private filter: ILogsFilter = {};
	private searchQuery: string = '';
	private autoScroll: boolean = true;
	private isAtBottom: boolean = true;

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

		this.loadLogs();
		this.loadFilterState();
		this.setupEventListeners();
	}

	protected override renderBody(container: HTMLElement): void {
		this.container = container;
		this.container.classList.add('nutanaa-logs');

		this.renderFilterBar();
		this.renderSearchBar();
		this.renderLogList();

		this.renderArrowDefs();
	}

	private renderArrowDefs(): void {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.style.width = '0';
		svg.style.height = '0';
		svg.style.position = 'absolute';

		const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
		const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
		marker.setAttribute('id', 'arrowhead');
		marker.setAttribute('markerWidth', '10');
		marker.setAttribute('markerHeight', '7');
		marker.setAttribute('refX', '9');
		marker.setAttribute('refY', '3.5');
		marker.setAttribute('orient', 'auto');

		const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
		polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
		polygon.setAttribute('fill', '#666');

		marker.appendChild(polygon);
		defs.appendChild(marker);
		svg.appendChild(defs);
		this.container.appendChild(svg);
	}

	private renderFilterBar(): void {
		this.filterContainer = append(this.container, $('.logs-filter'));

		const levels: Array<{ level: LogLevel; label: string; icon: string }> = [
			{ level: 'error', label: 'Error', icon: '❌' },
			{ level: 'warning', label: 'Warning', icon: '⚠️' },
			{ level: 'info', label: 'Info', icon: 'ℹ️' },
			{ level: 'debug', label: 'Debug', icon: '🔍' },
		];

		for (const level of levels) {
			const button = append(this.filterContainer, $(`.filter-toggle${this.isLevelFiltered(level.level) ? ' active' : ''}`));
			button.title = level.label;
			button.innerHTML = level.icon;
			button.dataset.level = level.level;

			this._register(addStandardDisposableListener(button, 'click', () => {
				this.toggleLevelFilter(level.level);
			}));
		}

		// Auto-scroll toggle
		const autoScrollBtn = append(this.filterContainer, $('button.auto-scroll-toggle.active'));
		autoScrollBtn.title = localize('autoScroll', 'Auto-scroll');
		autoScrollBtn.innerHTML = '📜';
		this._register(addStandardDisposableListener(autoScrollBtn, 'click', () => {
			this.autoScroll = !this.autoScroll;
			autoScrollBtn.classList.toggle('active', this.autoScroll);
		}));

		// Clear logs button
		const clearButton = append(this.filterContainer, $('button.clear-logs', {}, '🗑'));
		clearButton.title = localize('clearLogs', 'Clear Logs');
		this._register(addStandardDisposableListener(clearButton, 'click', () => {
			this.clearLogs();
		}));

		// Download button
		const downloadButton = append(this.filterContainer, $('button.download-logs', {}, '⬇'));
		downloadButton.title = localize('downloadLogs', 'Download Logs');
		this._register(addStandardDisposableListener(downloadButton, 'click', () => {
			this.downloadLogs();
		}));
	}

	private renderSearchBar(): void {
		this.searchContainer = append(this.container, $('.logs-search'));

		const searchInput = append(this.searchContainer, $('input.search-input', {
			placeholder: localize('searchLogs', 'Search logs...'),
		}));
		this._register(addStandardDisposableListener(searchInput, 'input', () => {
			this.searchQuery = searchInput.value;
			this.filterLogs();
		}));
	}

	private renderLogList(): void {
		this.scrollContainer = append(this.container, $('.logs-scroll'));
		this.listContainer = append(this.scrollContainer, $('.logs-list'));

		this._register(addStandardDisposableListener(this.scrollContainer, 'scroll', () => {
			this.handleScroll();
		}));

		this.renderLogs();
	}

	private renderLogs(): void {
		const filtered = this.getFilteredLogs();

		if (filtered.length === 0) {
			this.listContainer.innerHTML = '';
			append(this.listContainer, $('div.empty-state', {}, localize('noLogs', 'No logs to display')));
			return;
		}

		// Use document fragment for better performance
		const fragment = document.createDocumentFragment();

		for (const log of filtered) {
			const logElement = this.createLogElement(log);
			fragment.appendChild(logElement);
		}

		this.listContainer.innerHTML = '';
		this.listContainer.appendChild(fragment);

		if (this.autoScroll && this.isAtBottom) {
			this.scrollToBottom();
		}
	}

	private createLogElement(log: ILogEntry): HTMLElement {
		const element = append(this.listContainer, $(`.log-entry level-${log.level}`, {
			'data-log-id': log.id,
		}));

		const timestamp = append(element, $('span.log-timestamp', {}, this.formatTime(log.timestamp)));

		const level = append(element, $('span.log-level', {}, log.level.toUpperCase()));
		level.title = log.level;

		const source = append(element, $('span.log-source', {}, log.source || '-'));
		source.title = log.source || 'Unknown';

		const message = append(element, $('span.log-message', {}, log.message));
		message.title = log.message;

		if (log.category) {
			const category = append(element, $('span.log-category', {}, log.category));
			category.title = log.category;
		}

		if (log.correlationId) {
			const correlation = append(element, $('span.log-correlation', {}, log.correlationId.slice(0, 8)));
			this._register(addStandardDisposableListener(correlation, 'click', () => {
				this.filterByCorrelation(log.correlationId!);
			}));
		}

		this._register(addStandardDisposableListener(element, 'click', () => {
			this.copyLog(log);
		}));

		return element;
	}

	private getFilteredLogs(): ILogEntry[] {
		return this.logs.filter(log => {
			// Filter by levels
			if (this.filter.levels && this.filter.levels.length > 0) {
				if (!this.filter.levels.includes(log.level)) {
					return false;
				}
			}

			// Filter by sources
			if (this.filter.sources && this.filter.sources.length > 0) {
				if (!log.source || !this.filter.sources.includes(log.source)) {
					return false;
				}
			}

			// Filter by categories
			if (this.filter.categories && this.filter.categories.length > 0) {
				if (!log.category || !this.filter.categories.includes(log.category)) {
					return false;
				}
			}

			// Filter by search query
			if (this.searchQuery) {
				const query = this.searchQuery.toLowerCase();
				if (!log.message.toLowerCase().includes(query) &&
					!log.source?.toLowerCase().includes(query) &&
					!log.category?.toLowerCase().includes(query)) {
					return false;
				}
			}

			// Filter by time range
			if (this.filter.startTime && log.timestamp < this.filter.startTime) {
				return false;
			}
			if (this.filter.endTime && log.timestamp > this.filter.endTime) {
				return false;
			}

			return true;
		});
	}

	private filterLogs(): void {
		this.renderLogs();
	}

	private isLevelFiltered(level: LogLevel): boolean {
		return this.filter.levels?.includes(level) ?? false;
	}

	private toggleLevelFilter(level: LogLevel): void {
		if (!this.filter.levels) {
			this.filter.levels = [];
		}

		const index = this.filter.levels.indexOf(level);
		if (index >= 0) {
			this.filter.levels.splice(index, 1);
		} else {
			this.filter.levels.push(level);
		}

		this.updateFilterButtons();
		this.filterLogs();
		this.saveFilterState();
	}

	private updateFilterButtons(): void {
		const buttons = this.filterContainer.querySelectorAll('.filter-toggle');
		buttons.forEach(btn => {
			const level = btn.dataset.level as LogLevel;
			btn.classList.toggle('active', this.isLevelFiltered(level));
		});
	}

	private filterByCorrelation(correlationId: string): void {
		this.filter.correlationId = correlationId;
		this.renderLogs();
	}

	private formatTime(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
		});
	}

	private loadLogs(): void {
		const stored = this.storageService.get(LogsView.LOGS_STORE_KEY, 0);
		if (stored) {
			try {
				this.logs = JSON.parse(stored);
			} catch {
				this.logs = [];
			}
		}
	}

	private saveLogs(): void {
		if (this.logs.length > LogsView.MAX_LOGS) {
			this.logs = this.logs.slice(-LogsView.MAX_LOGS);
		}
		this.storageService.store(LogsView.LOGS_STORE_KEY, JSON.stringify(this.logs), 0);
	}

	private loadFilterState(): void {
		const stored = this.storageService.get(LogsView.FILTER_STATE_KEY, 0);
		if (stored) {
			try {
				this.filter = JSON.parse(stored);
			} catch {
				// Use default
			}
		}
	}

	private saveFilterState(): void {
		this.storageService.store(LogsView.FILTER_STATE_KEY, JSON.stringify(this.filter), 0);
	}

	private setupEventListeners(): void {
		// Subscribe to runtime logs
		this._register(this.runtimeEventBus.on(RuntimeEventType.RuntimeLog, (event) => {
			this.addLog({
				level: event.payload?.level || 'info',
				message: event.payload?.message || '',
				source: event.payload?.source || 'runtime',
				category: event.payload?.category,
				correlationId: event.payload?.correlationId,
				metadata: event.payload?.metadata,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.RuntimeError, (event) => {
			this.addLog({
				level: 'error',
				message: event.payload?.message || 'Unknown error',
				source: 'runtime',
				category: 'error',
				correlationId: event.payload?.correlationId,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.RuntimeWarning, (event) => {
			this.addLog({
				level: 'warning',
				message: event.payload?.message || 'Unknown warning',
				source: 'runtime',
				category: 'warning',
				correlationId: event.payload?.correlationId,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.RuntimeInfo, (event) => {
			this.addLog({
				level: 'info',
				message: event.payload?.message || 'Information',
				source: 'runtime',
				category: 'info',
				correlationId: event.payload?.correlationId,
			});
		}));

		// Also capture VS Code log service messages
		this._register(this.logService.onDidLog((e) => {
			if (e.level === 'error' || e.level === 'warning' || e.level === 'info') {
				this.addLog({
					level: e.level,
					message: e.message,
					source: 'nutanaa',
					category: e.type,
				});
			}
		}));
	}

	private addLog(log: Omit<ILogEntry, 'id' | 'timestamp'>): void {
		const newLog: ILogEntry = {
			...log,
			id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			timestamp: Date.now(),
		};

		this.logs.push(newLog);
		this.saveLogs();

		// Only append if log passes current filter
		if (this.logPassesFilter(newLog)) {
			const logElement = this.createLogElement(newLog);
			this.listContainer.appendChild(logElement);

			if (this.autoScroll && this.isAtBottom) {
				this.scrollToBottom();
			}
		}
	}

	private logPassesFilter(log: ILogEntry): boolean {
		if (this.filter.levels && this.filter.levels.length > 0) {
			if (!this.filter.levels.includes(log.level)) {
				return false;
			}
		}
		if (this.searchQuery) {
			const query = this.searchQuery.toLowerCase();
			if (!log.message.toLowerCase().includes(query)) {
				return false;
			}
		}
		return true;
	}

	private clearLogs(): void {
		this.logs = [];
		this.saveLogs();
		this.renderLogs();
	}

	private downloadLogs(): void {
		const filtered = this.getFilteredLogs();
		const exportData = {
			exportedAt: Date.now(),
			totalLogs: filtered.length,
			logs: filtered,
		};

		const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `logs-${Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	private copyLog(log: ILogEntry): void {
		const text = `[${this.formatTime(log.timestamp)}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`;
		navigator.clipboard.writeText(text).then(() => {
			this.logService.info('Log copied to clipboard');
		});
	}

	private scrollToBottom(): void {
		this.scrollContainer.scrollTop = this.scrollContainer.scrollHeight;
	}

	private handleScroll(): void {
		const { scrollTop, scrollHeight, clientHeight } = this.scrollContainer;
		this.isAtBottom = scrollTop + clientHeight >= scrollHeight - 50;

		if (!this.isAtBottom && this.autoScroll) {
			// User scrolled up, show indicator
			this.showScrollIndicator();
		}
	}

	private showScrollIndicator(): void {
		// TODO: Show "new logs available" indicator
	}

	public override dispose(): void {
		this.saveLogs();
		this._register.dispose();
		super.dispose();
	}
}

import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
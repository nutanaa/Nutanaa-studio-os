/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../../base/common/event.js';
import { append, $, clearNode, addStandardDisposableListener } from '../../../../../base/browser/dom.js';
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
import { AgentEvent, LogEvent, RuntimeEvent } from '../../common/runtime/runtimeEvent.js';
import { ILogEntry, ILogsFilter, LogLevel } from '../../models/studioModel.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';

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
export class LogsView extends FilterViewPane {

	private static readonly LOGS_STORE_KEY = 'nutanaa.logs';
	private static readonly FILTER_STATE_KEY = 'nutanaa.logs.filter';
	private static readonly MAX_LOGS = 5000;

	private readonly _onDidScrollToBottom = this._register(new Emitter<void>());
	public readonly onDidScrollToBottom = this._onDidScrollToBottom.event;

	private container!: HTMLElement;
	private logsFilterContainer!: HTMLElement;
	private searchContainer!: HTMLElement;
	private listContainer!: HTMLElement;
	private scrollContainer!: HTMLElement;

	private logs: ILogEntry[] = [];
	private filter: ILogsFilter = {};
	private searchQuery: string = '';
	private autoScroll: boolean = true;
	private isAtBottom: boolean = true;

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
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this.loadLogs();
		this.loadFilterState();
		this.setupEventListeners();
	}

	protected override renderBody(container: HTMLElement): void {
		this.container = container;
	}

	protected layoutBodyContent(height: number, width: number): void {
		this.container.classList.add('nutanaa-logs');

		this.renderFilterBar();
		this.renderSearchBar();
		this.renderLogList();

		this.renderArrowDefs();
	}

	private renderArrowDefs(): void {
		const existing = this.container.querySelector('svg#arrowhead');
		if (existing) {
			existing.remove();
		}

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
		this.logsFilterContainer = append(this.container, $('.logs-filter'));

		const levels: Array<{ level: LogLevel; label: string; icon: string }> = [
			{ level: 'error', label: 'Error', icon: '❌' },
			{ level: 'warning', label: 'Warning', icon: '⚠️' },
			{ level: 'info', label: 'Info', icon: 'ℹ️' },
			{ level: 'debug', label: 'Debug', icon: '🔍' },
		];

		for (const level of levels) {
			const button = append(this.logsFilterContainer, $(`.filter-toggle${this.isLevelFiltered(level.level) ? ' active' : ''}`));
			button.title = level.label;
			button.textContent = level.icon;
			(button as HTMLElement).dataset.level = level.level;

			this._register(addStandardDisposableListener(button as HTMLElement, 'click', () => {
				this.toggleLevelFilter(level.level);
			}));
		}

		// Auto-scroll toggle
		const autoScrollBtn = append(this.logsFilterContainer, $('button.auto-scroll-toggle.active'));
		autoScrollBtn.title = localize('autoScroll', 'Auto-scroll');
		autoScrollBtn.textContent = '📜';
		this._register(addStandardDisposableListener(autoScrollBtn as HTMLElement, 'click', () => {
			this.autoScroll = !this.autoScroll;
			autoScrollBtn.classList.toggle('active', this.autoScroll);
		}));

		// Clear logs button
		const clearButton = append(this.logsFilterContainer, $('button.clear-logs', {}, '🗑'));
		clearButton.title = localize('clearLogs', 'Clear Logs');
		this._register(addStandardDisposableListener(clearButton as HTMLElement, 'click', () => {
			this.clearLogs();
		}));

		// Download button
		const downloadButton = append(this.logsFilterContainer, $('button.download-logs', {}, '⬇'));
		downloadButton.title = localize('downloadLogs', 'Download Logs');
		this._register(addStandardDisposableListener(downloadButton as HTMLElement, 'click', () => {
			this.downloadLogs();
		}));
	}

	private renderSearchBar(): void {
		this.searchContainer = append(this.container, $('.logs-search'));

		const searchInput = append(this.searchContainer, $('input.search-input', {
			placeholder: localize('searchLogs', 'Search logs...'),
		}));
		this._register(addStandardDisposableListener(searchInput as HTMLElement, 'input', () => {
			this.searchQuery = (searchInput as HTMLInputElement).value;
			this.filterLogs();
		}));
	}

	private renderLogList(): void {
		this.scrollContainer = append(this.container, $('.logs-scroll'));
		this.listContainer = append(this.scrollContainer, $('.logs-list'));

		this._register(addStandardDisposableListener(this.scrollContainer as HTMLElement, 'scroll', () => {
			this.handleScroll();
		}));

		this.renderLogs();
	}

	private renderLogs(): void {
		const filtered = this.getFilteredLogs();

		if (filtered.length === 0) {
			clearNode(this.listContainer);
			append(this.listContainer, $('div.empty-state', {}, localize('noLogs', 'No logs to display')));
			return;
		}

		// Use document fragment for better performance
		const fragment = document.createDocumentFragment();

		for (const log of filtered) {
			const logElement = this.createLogElement(log);
			fragment.appendChild(logElement);
		}

		clearNode(this.listContainer);
		this.listContainer.appendChild(fragment);

		if (this.autoScroll && this.isAtBottom) {
			this.scrollToBottom();
		}
	}

	private createLogElement(log: ILogEntry): HTMLElement {
		const element = append(this.listContainer, $(`.log-entry level-${log.level}`, {
			'data-log-id': log.id,
		}));


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
			this._register(addStandardDisposableListener(correlation as HTMLElement, 'click', () => {
				this.filterByCorrelation(log.correlationId!);
			}));
		}

		this._register(addStandardDisposableListener(element as HTMLElement, 'click', () => {
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
		const current = this.filter.levels || [];
		const index = current.indexOf(level);
		if (index >= 0) {
			current.splice(index, 1);
		} else {
			current.push(level);
		}
		this.filter = { ...this.filter, levels: current };

		this.updateFilterButtons();
		this.filterLogs();
		this.saveFilterState();
	}

	private updateFilterButtons(): void {
		const buttons = this.logsFilterContainer.querySelectorAll('.filter-toggle');
		buttons.forEach(btn => {
			const level = (btn as HTMLElement).dataset.level as LogLevel;
			(btn as HTMLElement).classList.toggle('active', this.isLevelFiltered(level));
		});
	}

	private filterByCorrelation(correlationId: string): void {
		const current = this.filter.categories || [];
		this.filter = { ...this.filter, categories: [...current, correlationId] };
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
		const stored = this.storageService.get(LogsView.LOGS_STORE_KEY, StorageScope.APPLICATION);
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
		this.storageService.store(LogsView.LOGS_STORE_KEY, JSON.stringify(this.logs), StorageScope.APPLICATION, StorageTarget.USER);
	}

	private loadFilterState(): void {
		const stored = this.storageService.get(LogsView.FILTER_STATE_KEY, StorageScope.APPLICATION);
		if (stored) {
			try {
				this.filter = JSON.parse(stored);
			} catch {
				// Use default
			}
		}
	}

	private saveFilterState(): void {
		this.storageService.store(LogsView.FILTER_STATE_KEY, JSON.stringify(this.filter), StorageScope.APPLICATION, StorageTarget.USER);
	}

	private setupEventListeners(): void {
		this._register(this.runtimeEventBus.on<LogEvent>(RuntimeEventType.RuntimeError, (event: RuntimeEvent<LogEvent>) => {
			this.addLog({
				level: event.payload.level,
				message: event.payload.message,
				source: event.payload.source || 'runtime',
			});
		}));

		this._register(this.runtimeEventBus.on<AgentEvent>(RuntimeEventType.AgentFailed, (event: RuntimeEvent<AgentEvent>) => {
			this.addLog({
				level: 'error',
				message: event.payload.message || 'Agent failed',
				source: 'agent',
				category: 'agent',
			});
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
		super.dispose();
	}
}
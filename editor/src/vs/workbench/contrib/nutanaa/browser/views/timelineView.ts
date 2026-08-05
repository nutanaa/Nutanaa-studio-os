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
import { ITimelineEvent, ITimelineFilter, TimelineEventType } from '../../models/studioModel.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

/**
 * Timeline View for Nutanaa Studio OS.
 *
 * Responsibilities:
 * - Chronological event stream display
 * - Filter by event type, severity, source
 * - Search functionality
 * - Export capability
 */
export class TimelineView extends ViewPane {

	private static readonly FILTER_STATE_KEY = 'nutanaa.timeline.filter';
	private static readonly EVENTS_STORE_KEY = 'nutanaa.timeline.events';
	private static readonly MAX_EVENTS = 1000;

	private readonly _onDidSelectEvent = this._register(new Emitter<ITimelineEvent>());
	public readonly onDidSelectEvent = this._onDidSelectEvent.event;

	private container!: HTMLElement;
	private filterContainer!: HTMLElement;
	private searchContainer!: HTMLElement;
	private listContainer!: HTMLElement;
	private scrollContainer!: HTMLElement;

	private events: ITimelineEvent[] = [];
	private filter: ITimelineFilter = {};
	private searchQuery: string = '';

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

		this.loadEvents();
		this.loadFilterState();
		this.setupEventListeners();
	}

	protected override renderBody(container: HTMLElement): void {
		this.container = container;
		this.container.classList.add('nutanaa-timeline');

		this.renderFilterBar();
		this.renderSearchBar();
		this.renderEventList();

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
		this.filterContainer = append(this.container, $('.timeline-filter'));

		// Event type filters
		const eventTypes: Array<{ type: TimelineEventType; label: string; icon: string }> = [
			{ type: 'agent_started', label: 'Agent', icon: '🤖' },
			{ type: 'task_started', label: 'Task', icon: '📋' },
			{ type: 'workflow_started', label: 'Workflow', icon: '🔀' },
			{ type: 'provider_connected', label: 'Provider', icon: '🌐' },
			{ type: 'tool_started', label: 'Tool', icon: '🔧' },
			{ type: 'error', label: 'Error', icon: '❌' },
			{ type: 'warning', label: 'Warning', icon: '⚠️' },
			{ type: 'info', label: 'Info', icon: 'ℹ️' },
		];

		for (const et of eventTypes) {
			const button = append(this.filterContainer, $(`.filter-toggle${this.isEventTypeFiltered(et.type) ? ' active' : ''}`));
			button.title = et.label;
			button.innerHTML = `${et.icon}`;
			button.dataset.type = et.type;

			this._register(addStandardDisposableListener(button, 'click', () => {
				this.toggleEventTypeFilter(et.type);
			}));
		}

		// Clear filters button
		const clearButton = append(this.filterContainer, $('button.clear-filters', {}, localize('clearFilters', 'Clear')));
		this._register(addStandardDisposableListener(clearButton, 'click', () => {
			this.clearFilters();
		}));
	}

	private renderSearchBar(): void {
		this.searchContainer = append(this.container, $('.timeline-search'));

		const searchInput = append(this.searchContainer, $('input.search-input', {
			placeholder: localize('searchTimeline', 'Search timeline...'),
		}));
		this._register(addStandardDisposableListener(searchInput, 'input', () => {
			this.searchQuery = searchInput.value;
			this.filterEvents();
		}));

		const exportButton = append(this.searchContainer, $('button.export-button', {}, localize('export', 'Export')));
		this._register(addStandardDisposableListener(exportButton, 'click', () => {
			this.exportEvents();
		}));
	}

	private renderEventList(): void {
		this.scrollContainer = append(this.container, $('.timeline-scroll'));
		this.listContainer = append(this.scrollContainer, $('.timeline-list'));

		this._register(addStandardDisposableListener(this.scrollContainer, 'scroll', () => {
			this.handleScroll();
		}));

		this.renderEvents();
	}

	private renderEvents(): void {
		this.listContainer.innerHTML = '';

		const filtered = this.getFilteredEvents();

		if (filtered.length === 0) {
			append(this.listContainer, $('div.empty-state', {}, localize('noEvents', 'No events to display')));
			return;
		}

		// Group by date
		const grouped = this.groupByDate(filtered);

		for (const [date, dateEvents] of grouped) {
			const dateHeader = append(this.listContainer, $('div.date-header', {}, date));
			dateHeader.dataset.date = date;

			for (const event of dateEvents) {
				const eventElement = this.createEventElement(event);
				this.listContainer.appendChild(eventElement);
			}
		}
	}

	private createEventElement(event: ITimelineEvent): HTMLElement {
		const element = append(this.listContainer, $(`.timeline-event severity-${event.severity}`, {
			'data-event-id': event.id,
		}));

		const icon = append(element, $('.event-icon'));
		icon.innerHTML = this.getEventIcon(event.type);
		icon.title = event.type;

		const content = append(element, $('.event-content'));

		const header = append(content, $('.event-header'));

		const title = append(header, $('span.event-title', {}, event.title));
		title.title = event.title;

		const time = append(header, $('span.event-time', {}, this.formatTime(event.timestamp)));

		const description = append(content, $('span.event-description', {}, event.description));
		description.title = event.description;

		if (event.source) {
			const source = append(content, $('span.event-source', {}, event.source));
			source.title = event.source;
		}

		this._register(addStandardDisposableListener(element, 'click', () => {
			this._onDidSelectEvent.fire(event);
		}));

		return element;
	}

	private groupByDate(events: ITimelineEvent[]): Map<string, ITimelineEvent[]> {
		const grouped = new Map<string, ITimelineEvent[]>();

		for (const event of events) {
			const date = new Date(event.timestamp).toLocaleDateString();
			const existing = grouped.get(date) || [];
			existing.push(event);
			grouped.set(date, existing);
		}

		return grouped;
	}

	private getFilteredEvents(): ITimelineEvent[] {
		return this.events.filter(event => {
			// Filter by event types
			if (this.filter.eventTypes && this.filter.eventTypes.length > 0) {
				if (!this.filter.eventTypes.includes(event.type)) {
					return false;
				}
			}

			// Filter by severities
			if (this.filter.severities && this.filter.severities.length > 0) {
				if (!this.filter.severities.includes(event.severity)) {
					return false;
				}
			}

			// Filter by sources
			if (this.filter.sources && this.filter.sources.length > 0) {
				if (!event.source || !this.filter.sources.includes(event.source)) {
					return false;
				}
			}

			// Filter by search query
			if (this.searchQuery) {
				const query = this.searchQuery.toLowerCase();
				if (!event.title.toLowerCase().includes(query) &&
					!event.description.toLowerCase().includes(query) &&
					!event.source?.toLowerCase().includes(query)) {
					return false;
				}
			}

			// Filter by time range
			if (this.filter.startTime && event.timestamp < this.filter.startTime) {
				return false;
			}
			if (this.filter.endTime && event.timestamp > this.filter.endTime) {
				return false;
			}

			return true;
		});
	}

	private filterEvents(): void {
		this.renderEvents();
	}

	private isEventTypeFiltered(type: TimelineEventType): boolean {
		return this.filter.eventTypes?.includes(type) ?? false;
	}

	private toggleEventTypeFilter(type: TimelineEventType): void {
		if (!this.filter.eventTypes) {
			this.filter.eventTypes = [];
		}

		const index = this.filter.eventTypes.indexOf(type);
		if (index >= 0) {
			this.filter.eventTypes.splice(index, 1);
		} else {
			this.filter.eventTypes.push(type);
		}

		this.updateFilterButtons();
		this.filterEvents();
		this.saveFilterState();
	}

	private clearFilters(): void {
		this.filter = {};
		this.searchQuery = '';
		const searchInput = this.searchContainer?.querySelector('.search-input') as HTMLInputElement;
		if (searchInput) {
			searchInput.value = '';
		}
		this.updateFilterButtons();
		this.filterEvents();
		this.saveFilterState();
	}

	private updateFilterButtons(): void {
		const buttons = this.filterContainer.querySelectorAll('.filter-toggle');
		buttons.forEach(btn => {
			const type = btn.dataset.type as TimelineEventType;
			btn.classList.toggle('active', this.isEventTypeFiltered(type));
		});
	}

	private getEventIcon(type: TimelineEventType): string {
		const iconMap: Record<TimelineEventType, string> = {
			agent_started: '🤖',
			agent_completed: '✅',
			agent_failed: '❌',
			task_started: '📋',
			task_completed: '✅',
			task_failed: '❌',
			workflow_started: '🔀',
			workflow_completed: '✅',
			workflow_failed: '❌',
			provider_connected: '🌐',
			provider_disconnected: '🔌',
			provider_failed: '❌',
			prompt_rendered: '📝',
			memory_updated: '💾',
			embedding_created: '📊',
			tool_started: '🔧',
			tool_completed: '✅',
			tool_failed: '❌',
			connection_status: '🔗',
			error: '❌',
			warning: '⚠️',
			info: 'ℹ️',
		};
		return iconMap[type] || '●';
	}

	private formatTime(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
	}

	private loadEvents(): void {
		const stored = this.storageService.get(TimelineView.EVENTS_STORE_KEY, 0);
		if (stored) {
			try {
				this.events = JSON.parse(stored);
			} catch {
				this.events = [];
			}
		}
	}

	private saveEvents(): void {
		// Trim to max events
		if (this.events.length > TimelineView.MAX_EVENTS) {
			this.events = this.events.slice(-TimelineView.MAX_EVENTS);
		}
		this.storageService.store(TimelineView.EVENTS_STORE_KEY, JSON.stringify(this.events), 0);
	}

	private loadFilterState(): void {
		const stored = this.storageService.get(TimelineView.FILTER_STATE_KEY, 0);
		if (stored) {
			try {
				this.filter = JSON.parse(stored);
			} catch {
				// Use default
			}
		}
	}

	private saveFilterState(): void {
		this.storageService.store(TimelineView.FILTER_STATE_KEY, JSON.stringify(this.filter), 0);
	}

	private setupEventListeners(): void {
		// Subscribe to all runtime events
		this._register(this.runtimeEventBus.on(RuntimeEventType.AgentStarted, (event) => {
			this.addEvent({
				type: 'agent_started',
				title: 'Agent Started',
				description: event.payload?.agentId || 'Unknown',
				source: 'agent',
				severity: 'info',
				metadata: event.payload,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.AgentCompleted, (event) => {
			this.addEvent({
				type: 'agent_completed',
				title: 'Agent Completed',
				description: event.payload?.agentId || 'Unknown',
				source: 'agent',
				severity: 'info',
				metadata: event.payload,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.AgentFailed, (event) => {
			this.addEvent({
				type: 'agent_failed',
				title: 'Agent Failed',
				description: event.payload?.error || 'Unknown error',
				source: 'agent',
				severity: 'error',
				metadata: event.payload,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.TaskScheduled, (event) => {
			this.addEvent({
				type: 'task_started',
				title: 'Task Scheduled',
				description: event.payload?.taskId || 'Unknown',
				source: 'task',
				severity: 'info',
				metadata: event.payload,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.TaskCompleted, (event) => {
			this.addEvent({
				type: 'task_completed',
				title: 'Task Completed',
				description: event.payload?.taskId || 'Unknown',
				source: 'task',
				severity: 'info',
				metadata: event.payload,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.WorkflowStarted, (event) => {
			this.addEvent({
				type: 'workflow_started',
				title: 'Workflow Started',
				description: event.payload?.workflowId || 'Unknown',
				source: 'workflow',
				severity: 'info',
				metadata: event.payload,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.WorkflowCompleted, (event) => {
			this.addEvent({
				type: 'workflow_completed',
				title: 'Workflow Completed',
				description: event.payload?.workflowId || 'Unknown',
				source: 'workflow',
				severity: 'info',
				metadata: event.payload,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.WorkflowFailed, (event) => {
			this.addEvent({
				type: 'workflow_failed',
				title: 'Workflow Failed',
				description: event.payload?.error || 'Unknown',
				source: 'workflow',
				severity: 'error',
				metadata: event.payload,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.ProviderHealthy, (event) => {
			this.addEvent({
				type: 'provider_connected',
				title: 'Provider Connected',
				description: event.payload?.name || 'Unknown',
				source: 'provider',
				severity: 'info',
				metadata: event.payload,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.ProviderUnhealthy, (event) => {
			this.addEvent({
				type: 'provider_disconnected',
				title: 'Provider Disconnected',
				description: event.payload?.name || 'Unknown',
				source: 'provider',
				severity: 'warning',
				metadata: event.payload,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.ToolStarted, (event) => {
			this.addEvent({
				type: 'tool_started',
				title: 'Tool Started',
				description: event.payload?.toolName || 'Unknown',
				source: 'tool',
				severity: 'info',
				metadata: event.payload,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.ToolCompleted, (event) => {
			this.addEvent({
				type: 'tool_completed',
				title: 'Tool Completed',
				description: event.payload?.toolName || 'Unknown',
				source: 'tool',
				severity: 'info',
				metadata: event.payload,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.ToolFailed, (event) => {
			this.addEvent({
				type: 'tool_failed',
				title: 'Tool Failed',
				description: event.payload?.error || 'Unknown',
				source: 'tool',
				severity: 'error',
				metadata: event.payload,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.RuntimeError, (event) => {
			this.addEvent({
				type: 'error',
				title: 'Runtime Error',
				description: event.payload?.message || 'Unknown error',
				source: 'runtime',
				severity: 'error',
				metadata: event.payload,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.RuntimeWarning, (event) => {
			this.addEvent({
				type: 'warning',
				title: 'Runtime Warning',
				description: event.payload?.message || 'Unknown warning',
				source: 'runtime',
				severity: 'warning',
				metadata: event.payload,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.RuntimeInfo, (event) => {
			this.addEvent({
				type: 'info',
				title: 'Runtime Info',
				description: event.payload?.message || 'Information',
				source: 'runtime',
				severity: 'info',
				metadata: event.payload,
			});
		}));
	}

	private addEvent(event: Omit<ITimelineEvent, 'id' | 'timestamp'>): void {
		const newEvent: ITimelineEvent = {
			...event,
			id: `event-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			timestamp: Date.now(),
		};

		this.events.push(newEvent);
		this.saveEvents();

		// Only re-render if event passes current filter
		if (this.eventPassesFilter(newEvent)) {
			this.renderEvents();
		}
	}

	private eventPassesFilter(event: ITimelineEvent): boolean {
		if (this.filter.eventTypes && this.filter.eventTypes.length > 0) {
			if (!this.filter.eventTypes.includes(event.type)) {
				return false;
			}
		}
		if (this.searchQuery) {
			const query = this.searchQuery.toLowerCase();
			if (!event.title.toLowerCase().includes(query) &&
				!event.description.toLowerCase().includes(query)) {
				return false;
			}
		}
		return true;
	}

	private exportEvents(): void {
		const filtered = this.getFilteredEvents();
		const exportData = {
			exportedAt: Date.now(),
			totalEvents: filtered.length,
			events: filtered,
		};

		const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `timeline-${Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	private handleScroll(): void {
		// Lazy loading could be implemented here
	}

	public override dispose(): void {
		this.saveEvents();
		this._register.dispose();
		super.dispose();
	}
}

import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
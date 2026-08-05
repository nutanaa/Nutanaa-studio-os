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
import { IMemoryExplorerEntry, IMemoryExplorerFilter } from '../../models/studioModel.js';
import { IMemoryManager, MemoryStorageType } from '../../common/memoryManager.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

/**
 * Memory Explorer View for Nutanaa Studio OS.
 *
 * Responsibilities:
 * - Display memories by type (conversation, agent, workspace, project, knowledge)
 * - Search functionality
 * - Memory deletion
 * - Refresh capability
 */
export class MemoryExplorerView extends ViewPane {

	private container!: HTMLElement;
	private filterContainer!: HTMLElement;
	private searchContainer!: HTMLElement;
	private listContainer!: HTMLElement;

	private memories: IMemoryExplorerEntry[] = [];
	private filter: IMemoryExplorerFilter = {};
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
		@IMemoryManager private readonly memoryManager: IMemoryManager,
		@IConfigurationService configurationService: IConfigurationService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super(options, instantiationService, contextViewService, configurationService, keybindingService, themeService, storageService, logService, hoverService);

		this._register = new DisposableStore();
	}

	protected override renderBody(container: HTMLElement): void {
		this.container = container;
		this.container.classList.add('nutanaa-memory-explorer');

		this.renderFilterBar();
		this.renderSearchBar();
		this.renderMemoryList();

		this.loadMemories();
	}

	private renderFilterBar(): void {
		this.filterContainer = append(this.container, $('.memory-filter'));

		const types: Array<{ type: MemoryStorageType; label: string; icon: string }> = [
			{ type: 'conversation', label: 'Conversation', icon: '💬' },
			{ type: 'agent', label: 'Agent', icon: '🤖' },
			{ type: 'workspace', label: 'Workspace', icon: '📁' },
			{ type: 'project', label: 'Project', icon: '📂' },
			{ type: 'knowledge', label: 'Knowledge', icon: '📚' },
		];

		for (const type of types) {
			const button = append(this.filterContainer, $(`.filter-toggle${this.isTypeFiltered(type.type) ? ' active' : ''}`));
			button.title = type.label;
			button.innerHTML = type.icon;
			button.dataset.type = type.type;

			this._register(addStandardDisposableListener(button, 'click', () => {
				this.toggleTypeFilter(type.type);
			}));
		}

		const spacer = append(this.filterContainer, $('div.filter-spacer'));

		const refreshButton = append(this.filterContainer, $('button.refresh-button', {}, '↻'));
		refreshButton.title = localize('refresh', 'Refresh');
		this._register(addStandardDisposableListener(refreshButton, 'click', () => {
			this.loadMemories();
		}));

		const clearAllButton = append(this.filterContainer, $('button.clear-button', {}, '🗑'));
		clearAllButton.title = localize('clearAll', 'Clear All');
		this._register(addStandardDisposableListener(clearAllButton, 'click', () => {
			this.clearAllMemories();
		}));
	}

	private renderSearchBar(): void {
		this.searchContainer = append(this.container, $('.memory-search'));

		const searchInput = append(this.searchContainer, $('input.search-input', {
			placeholder: localize('searchMemory', 'Search memories...'),
		}));
		this._register(addStandardDisposableListener(searchInput, 'input', () => {
			this.searchQuery = searchInput.value;
			this.filterMemories();
		}));
	}

	private renderMemoryList(): void {
		this.listContainer = append(this.container, $('.memory-list'));

		this.renderMemories();
	}

	private renderMemories(): void {
		const filtered = this.getFilteredMemories();

		if (filtered.length === 0) {
			this.listContainer.innerHTML = '';
			append(this.listContainer, $('div.empty-state', {}, localize('noMemories', 'No memories to display')));
			return;
		}

		// Group by type
		const grouped = new Map<MemoryStorageType, IMemoryExplorerEntry[]>();

		for (const memory of filtered) {
			const existing = grouped.get(memory.type as MemoryStorageType) || [];
			existing.push(memory);
			grouped.set(memory.type as MemoryStorageType, existing);
		}

		const fragment = document.createDocumentFragment();

		for (const [type, memories] of grouped) {
			const groupHeader = append(fragment, $('div.memory-group-header'));
			groupHeader.innerHTML = this.getTypeIcon(type as MemoryStorageType);
			groupHeader.dataset.type = type;

			for (const memory of memories) {
				const memoryElement = this.createMemoryElement(memory);
				fragment.appendChild(memoryElement);
			}
		}

		this.listContainer.innerHTML = '';
		this.listContainer.appendChild(fragment);
	}

	private createMemoryElement(memory: IMemoryExplorerEntry): HTMLElement {
		const element = append(this.listContainer, $(`.memory-entry type-${memory.type}`, {
			'memory-id': memory.id,
		}));

		// Key
		const key = append(element, $('span.memory-key', {}, memory.key));
		key.title = memory.key;

		// Preview
		const preview = append(element, $('span.memory-preview', {}, memory.preview));
		preview.title = memory.content;

		// Tags
		if (memory.tags.length > 0) {
			const tags = append(element, $('.memory-tags'));
			for (const tag of memory.tags.slice(0, 3)) {
				append(tags, $('span.memory-tag', {}, tag));
			}
			if (memory.tags.length > 3) {
				append(tags, $('span.memory-tag.more', {}, `+${memory.tags.length - 3}`));
			}
		}

		// Metadata
		const metadata = append(element, $('.memory-metadata'));

		const time = append(metadata, $('span.memory-time', {}, this.formatRelativeTime(memory.timestamp)));
		time.title = new Date(memory.timestamp).toLocaleString();

		const access = append(metadata, $('span.memory-access', {}, `${memory.accessCount} accesses`));

		const score = append(metadata, $('span.memory-score', {}, `score: ${memory.score.toFixed(2)}`));

		// Actions
		const actions = append(element, $('.memory-actions'));

		const viewButton = append(actions, $('button.action-button', {}, '👁'));
		viewButton.title = localize('view', 'View');
		this._register(addStandardDisposableListener(viewButton, 'click', () => {
			this.viewMemory(memory);
		}));

		const deleteButton = append(actions, $('button.action-button.danger', {}, '🗑'));
		deleteButton.title = localize('delete', 'Delete');
		this._register(addStandardDisposableListener(deleteButton, 'click', () => {
			this.deleteMemory(memory.id);
		}));

		this._register(addStandardDisposableListener(element, 'click', (e) => {
			if (!(e.target as HTMLElement).closest('.memory-actions')) {
				this.viewMemory(memory);
			}
		}));

		return element;
	}

	private getFilteredMemories(): IMemoryExplorerEntry[] {
		return this.memories.filter(memory => {
			// Filter by types
			if (this.filter.types && this.filter.types.length > 0) {
				if (!this.filter.types.includes(memory.type as MemoryStorageType)) {
					return false;
				}
			}

			// Filter by tags
			if (this.filter.tags && this.filter.tags.length > 0) {
				if (!memory.tags.some(tag => this.filter.tags!.includes(tag))) {
					return false;
				}
			}

			// Filter by search query
			if (this.searchQuery) {
				const query = this.searchQuery.toLowerCase();
				if (!memory.key.toLowerCase().includes(query) &&
					!memory.content.toLowerCase().includes(query) &&
					!memory.tags.some(tag => tag.toLowerCase().includes(query))) {
					return false;
				}
			}

			return true;
		});
	}

	private filterMemories(): void {
		this.renderMemories();
	}

	private isTypeFiltered(type: MemoryStorageType): boolean {
		return this.filter.types?.includes(type) ?? false;
	}

	private toggleTypeFilter(type: MemoryStorageType): void {
		if (!this.filter.types) {
			this.filter.types = [];
		}

		const index = this.filter.types.indexOf(type);
		if (index >= 0) {
			this.filter.types.splice(index, 1);
		} else {
			this.filter.types.push(type);
		}

		this.updateFilterButtons();
		this.filterMemories();
	}

	private updateFilterButtons(): void {
		const buttons = this.filterContainer.querySelectorAll('.filter-toggle');
		buttons.forEach(btn => {
			const type = btn.dataset.type as MemoryStorageType;
			btn.classList.toggle('active', this.isTypeFiltered(type));
		});
	}

	private getTypeIcon(type: MemoryStorageType): string {
		const icons: Record<MemoryStorageType, string> = {
			conversation: '💬',
			agent: '🤖',
			workspace: '📁',
			project: '📂',
			knowledge: '📚',
		};
		return icons[type] || '📦';
	}

	private formatRelativeTime(timestamp: number): string {
		const diff = Date.now() - timestamp;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		if (minutes > 0) return `${minutes}m ago`;
		return 'Just now';
	}

	private loadMemories(): void {
		const state = this.runtimeStateService.getState();
		const memoryState = state.memory;

		this.memories = [];

		// Convert memory state entries to explorer entries
		for (const entry of memoryState.recentEntries || []) {
			const content = typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content);
			const preview = content.slice(0, 100) + (content.length > 100 ? '...' : '');

			this.memories.push({
				id: entry.id,
				type: entry.type,
				key: entry.key,
				content,
				preview,
				tags: entry.tags,
				timestamp: entry.timestamp,
				lastAccessed: entry.lastAccessedTimestamp,
				accessCount: entry.accessCount,
				score: entry.score,
			});
		}

		this.renderMemories();
	}

	private viewMemory(memory: IMemoryExplorerEntry): void {
		// TODO: Show memory detail view
	}

	private deleteMemory(memoryId: string): void {
		if (confirm(localize('confirmDeleteMemory', 'Are you sure you want to delete this memory?'))) {
			this.memoryManager.deleteMemory(memoryId);
			this.loadMemories();
		}
	}

	private clearAllMemories(): void {
		if (confirm(localize('confirmClearAllMemory', 'Are you sure you want to clear all memories? This cannot be undone.'))) {
			const types = this.filter.types || ['conversation', 'agent', 'workspace', 'project', 'knowledge'];
			for (const type of types) {
				this.memoryManager.deleteMemoriesByType(type as MemoryStorageType);
			}
			this.loadMemories();
		}
	}

	public override dispose(): void {
		this._register.dispose();
		super.dispose();
	}
}

import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
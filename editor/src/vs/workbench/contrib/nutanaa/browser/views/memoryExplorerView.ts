/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { append, $, clearNode, addStandardDisposableListener } from '../../../../../base/browser/dom.js';
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
import { IRuntimeStateService } from '../../common/runtime/runtimeState.js';
import { IMemoryExplorerEntry, IMemoryExplorerFilter } from '../../models/studioModel.js';
import { IMemoryManager } from '../../common/memory/memoryManager.js';
import { MemoryStorageType } from '../../models/aiCore.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';

/**
 * Memory Explorer View for Nutanaa Studio OS.
 *
 * Responsibilities:
 * - Display memories by type (conversation, agent, workspace, project, knowledge)
 * - Search functionality
 * - Memory deletion
 * - Refresh capability
 */
export class MemoryExplorerView extends FilterViewPane {

	private container!: HTMLElement;
	private memoryFilterContainer!: HTMLElement;
	private searchContainer!: HTMLElement;
	private listContainer!: HTMLElement;

	private memories: IMemoryExplorerEntry[] = [];
	private filter: IMemoryExplorerFilter = {};
	private searchQuery: string = '';

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
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IMemoryManager private readonly memoryManager: IMemoryManager,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		this.container = container;
	}

	protected layoutBodyContent(height: number, width: number): void {
		this.container.classList.add('nutanaa-memory-explorer');

		this.renderFilterBar();
		this.renderSearchBar();
		this.renderMemoryList();

		this.loadMemories();
	}

	private renderFilterBar(): void {
		this.memoryFilterContainer = append(this.container, $('.memory-filter'));

		const types: Array<{ type: MemoryStorageType; label: string; icon: string }> = [
			{ type: 'conversation', label: 'Conversation', icon: '💬' },
			{ type: 'agent', label: 'Agent', icon: '🤖' },
			{ type: 'workspace', label: 'Workspace', icon: '📁' },
			{ type: 'project', label: 'Project', icon: '📂' },
			{ type: 'knowledge', label: 'Knowledge', icon: '📚' },
		];

		for (const type of types) {
			const button = append(this.memoryFilterContainer, $(`.filter-toggle${this.isTypeFiltered(type.type) ? ' active' : ''}`));
			button.title = type.label;
			button.textContent = type.icon;
			(button as HTMLElement).dataset.type = type.type;

			this._register(addStandardDisposableListener(button as HTMLElement, 'click', () => {
				this.toggleTypeFilter(type.type);
			}));
		}

		append(this.memoryFilterContainer, $('div.filter-spacer'));

		const refreshButton = append(this.memoryFilterContainer, $('button.refresh-button', {}, '↻'));
		refreshButton.title = localize('refresh', 'Refresh');
		this._register(addStandardDisposableListener(refreshButton as HTMLElement, 'click', () => {
			this.loadMemories();
		}));

		const clearAllButton = append(this.memoryFilterContainer, $('button.clear-button', {}, '🗑'));
		clearAllButton.title = localize('clearAll', 'Clear All');
		this._register(addStandardDisposableListener(clearAllButton as HTMLElement, 'click', () => {
			this.clearAllMemories();
		}));
	}

	private renderSearchBar(): void {
		this.searchContainer = append(this.container, $('.memory-search'));

		const searchInput = append(this.searchContainer, $('input.search-input', {
			placeholder: localize('searchMemory', 'Search memories...'),
		}));
		this._register(addStandardDisposableListener(searchInput as HTMLElement, 'input', () => {
			this.searchQuery = (searchInput as HTMLInputElement).value;
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
			clearNode(this.listContainer);
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
			const groupHeader = fragment.appendChild($('div.memory-group-header'));
			groupHeader.textContent = this.getTypeIcon(type as MemoryStorageType);
			(groupHeader as HTMLElement).dataset.type = type;

			for (const memory of memories) {
				const memoryElement = this.createMemoryElement(memory);
				fragment.appendChild(memoryElement);
			}
		}

		clearNode(this.listContainer);
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

		// Actions
		const actions = append(element, $('.memory-actions'));

		const viewButton = append(actions, $('button.action-button', {}, '👁'));
		viewButton.title = localize('view', 'View');
		this._register(addStandardDisposableListener(viewButton as HTMLElement, 'click', () => {
			this.viewMemory(memory);
		}));

		const deleteButton = append(actions, $('button.action-button.danger', {}, '🗑'));
		deleteButton.title = localize('delete', 'Delete');
		this._register(addStandardDisposableListener(deleteButton as HTMLElement, 'click', () => {
			this.deleteMemory(memory.id);
		}));

		this._register(addStandardDisposableListener(element as HTMLElement, 'click', (e) => {
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
		const current = this.filter.types || [];
		const index = current.indexOf(type);
		if (index >= 0) {
			current.splice(index, 1);
		} else {
			current.push(type);
		}
		this.filter = { ...this.filter, types: current };

		this.updateFilterButtons();
		this.filterMemories();
	}

	private updateFilterButtons(): void {
		const buttons = this.memoryFilterContainer.querySelectorAll('.filter-toggle');
		buttons.forEach(btn => {
			const type = (btn as HTMLElement).dataset.type as MemoryStorageType;
			(btn as HTMLElement).classList.toggle('active', this.isTypeFiltered(type));
		});
	}

	private getTypeIcon(type: MemoryStorageType): string {
		const icons: Record<MemoryStorageType, string> = {
			conversation: 'ðŸ’¬',
			agent: 'ðŸ¤–',
			workspace: 'ðŸ“',
			project: 'ðŸ“‚',
			knowledge: 'ðŸ“š',
			session: 'ðŸ”—',
		};
		return icons[type] || 'ðŸ“¦';
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
			type: entry.type as 'conversation' | 'agent' | 'workspace' | 'project' | 'knowledge',
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
		super.dispose();
	}
}
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
import { IToolExplorerEntry, IToolExplorerFilter } from '../../models/studioModel.js';
import { IToolManager, ToolPermission } from '../../common/toolManager.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

/**
 * Tool Explorer View for Nutanaa Studio OS.
 *
 * Responsibilities:
 * - Display registered tools
 * - Show tool permissions
 * - Tool execution history
 * - Tool metrics
 * - Enable/disable tools
 */
export class ToolExplorerView extends ViewPane {

	private container!: HTMLElement;
	private filterContainer!: HTMLElement;
	private searchContainer!: HTMLElement;
	private listContainer!: HTMLElement;

	private tools: IToolExplorerEntry[] = [];
	private filter: IToolExplorerFilter = {};
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
		@IToolManager private readonly toolManager: IToolManager,
		@IConfigurationService configurationService: IConfigurationService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super(options, instantiationService, contextViewService, configurationService, keybindingService, themeService, storageService, logService, hoverService);

		this._register = new DisposableStore();
	}

	protected override renderBody(container: HTMLElement): void {
		this.container = container;
		this.container.classList.add('nutanaa-tool-explorer');

		this.renderFilterBar();
		this.renderSearchBar();
		this.renderToolList();

		this.loadTools();
	}

	private renderFilterBar(): void {
		this.filterContainer = append(this.container, $('.tool-filter'));

		const categories = [
			{ category: 'File Operations', icon: '📁' },
			{ category: 'System', icon: '⚙️' },
			{ category: 'Search', icon: '🔍' },
			{ category: 'Version Control', icon: '🔀' },
			{ category: 'Network', icon: '🌐' },
			{ category: 'Workspace', icon: '📋' },
			{ category: 'Database', icon: '🗄️' },
			{ category: 'Memory', icon: '💾' },
		];

		for (const cat of categories) {
			const button = append(this.filterContainer, $(`.filter-toggle${this.isCategoryFiltered(cat.category) ? ' active' : ''}`));
			button.title = cat.category;
			button.innerHTML = cat.icon;
			button.dataset.category = cat.category;

			this._register(addStandardDisposableListener(button, 'click', () => {
				this.toggleCategoryFilter(cat.category);
			}));
		}

		const spacer = append(this.filterContainer, $('div.filter-spacer'));

		const enabledToggle = append(this.filterContainer, $('label.toggle-label'));
		const toggle = append(enabledToggle, $('input.toggle-input', { type: 'checkbox', checked: this.filter.enabledOnly }));
		this._register(addStandardDisposableListener(toggle, 'change', () => {
			this.filter.enabledOnly = toggle.checked;
			this.filterTools();
		}));
		append(enabledToggle, $('span.toggle-label', {}, localize('enabledOnly', 'Enabled Only')));

		const refreshButton = append(this.filterContainer, $('button.refresh-button', {}, '↻'));
		refreshButton.title = localize('refresh', 'Refresh');
		this._register(addStandardDisposableListener(refreshButton, 'click', () => {
			this.loadTools();
		}));
	}

	private renderSearchBar(): void {
		this.searchContainer = append(this.container, $('.tool-search'));

		const searchInput = append(this.searchContainer, $('input.search-input', {
			placeholder: localize('searchTools', 'Search tools...'),
		}));
		this._register(addStandardDisposableListener(searchInput, 'input', () => {
			this.searchQuery = searchInput.value;
			this.filterTools();
		}));
	}

	private renderToolList(): void {
		this.listContainer = append(this.container, $('.tool-list'));

		this.renderTools();
	}

	private renderTools(): void {
		const filtered = this.getFilteredTools();

		if (filtered.length === 0) {
			this.listContainer.innerHTML = '';
			append(this.listContainer, $('div.empty-state', {}, localize('noTools', 'No tools to display')));
			return;
		}

		const fragment = document.createDocumentFragment();

		for (const tool of filtered) {
			const toolElement = this.createToolElement(tool);
			fragment.appendChild(toolElement);
		}

		this.listContainer.innerHTML = '';
		this.listContainer.appendChild(fragment);
	}

	private createToolElement(tool: IToolExplorerEntry): HTMLElement {
		const element = append(this.listContainer, $(`.tool-entry${!tool.isEnabled ? ' disabled' : ''}`, {
			'tool-id': tool.id,
		}));

		// Icon
		const icon = append(element, $('span.tool-icon', {}, this.getCategoryIcon(tool.category)));
		icon.title = tool.category;

		// Main content
		const content = append(element, $('.tool-content'));

		const header = append(content, $('.tool-header'));

		const name = append(header, $('span.tool-name', {}, tool.name));
		name.title = tool.name;

		const version = append(header, $('span.tool-version', {}, `v${tool.version}`));

		// Description
		const description = append(content, $('span.tool-description', {}, tool.description));
		description.title = tool.description;

		// Permissions
		const permissions = append(element, $('.tool-permissions'));
		for (const perm of tool.permissions) {
			const permBadge = append(permissions, $('span.permission-badge', {}, perm));
			permBadge.title = this.getPermissionDescription(perm);
		}

		// Metrics
		const metrics = append(element, $('.tool-metrics'));

		const executions = append(metrics, $('span.tool-metric', {}, `${tool.executionCount} runs`));

		const success = append(metrics, $('span.tool-metric', {}, `${tool.successRate.toFixed(0)}%`));

		const time = append(metrics, $('span.tool-metric', {}, `${tool.averageExecutionTime.toFixed(0)}ms avg`));

		// Actions
		const actions = append(element, $('.tool-actions'));

		const toggleButton = append(actions, $('button.action-button${tool.isEnabled ? '' : ' disabled'}', {}, tool.isEnabled ? 'Disable' : 'Enable'));
		this._register(addStandardDisposableListener(toggleButton, 'click', () => {
			this.toggleTool(tool.id);
		}));

		const executeButton = append(actions, $('button.action-button', {}, '▶'));
		executeButton.title = localize('execute', 'Execute');
		this._register(addStandardDisposableListener(executeButton, 'click', () => {
			this.executeTool(tool.id);
		}));

		this._register(addStandardDisposableListener(element, 'click', () => {
			this.showToolDetails(tool);
		}));

		return element;
	}

	private getFilteredTools(): IToolExplorerEntry[] {
		return this.tools.filter(tool => {
			// Filter by category
			if (this.filter.categories && this.filter.categories.length > 0) {
				if (!this.filter.categories.includes(tool.category)) {
					return false;
				}
			}

			// Filter by enabled only
			if (this.filter.enabledOnly && !tool.isEnabled) {
				return false;
			}

			// Filter by search query
			if (this.searchQuery) {
				const query = this.searchQuery.toLowerCase();
				if (!tool.name.toLowerCase().includes(query) &&
					!tool.description.toLowerCase().includes(query) &&
					!tool.category.toLowerCase().includes(query)) {
					return false;
				}
			}

			return true;
		});
	}

	private filterTools(): void {
		this.renderTools();
	}

	private isCategoryFiltered(category: string): boolean {
		return this.filter.categories?.includes(category) ?? false;
	}

	private toggleCategoryFilter(category: string): void {
		if (!this.filter.categories) {
			this.filter.categories = [];
		}

		const index = this.filter.categories.indexOf(category);
		if (index >= 0) {
			this.filter.categories.splice(index, 1);
		} else {
			this.filter.categories.push(category);
		}

		this.updateFilterButtons();
		this.filterTools();
	}

	private updateFilterButtons(): void {
		const buttons = this.filterContainer.querySelectorAll('.filter-toggle');
		buttons.forEach(btn => {
			const category = btn.dataset.category;
			btn.classList.toggle('active', this.isCategoryFiltered(category));
		});
	}

	private getCategoryIcon(category: string): string {
		const icons: Record<string, string> = {
			'File Operations': '📁',
			'System': '⚙️',
			'Search': '🔍',
			'Version Control': '🔀',
			'Network': '🌐',
			'Workspace': '📋',
			'Database': '🗄️',
			'Memory': '💾',
		};
		return icons[category] || '🔧';
	}

	private getPermissionDescription(permission: ToolPermission): string {
		const descriptions: Record<ToolPermission, string> = {
			read: 'Can read files and data',
			write: 'Can create and modify files',
			execute: 'Can run commands',
			admin: 'Has administrative access',
		};
		return descriptions[permission] || permission;
	}

	private loadTools(): void {
		const allTools = this.toolManager.getAllTools();

		this.tools = allTools.map(tool => ({
			id: tool.id,
			name: tool.name,
			description: tool.description,
			type: tool.type,
			category: tool.category,
			permissions: tool.permissions,
			isEnabled: tool.enabled,
			requiresConfirmation: tool.requiresConfirmation,
			executionCount: Math.floor(Math.random() * 100), // Would come from metrics
			successRate: 85 + Math.random() * 15, // Would come from metrics
			averageExecutionTime: 50 + Math.random() * 200, // Would come from metrics
		}));

		this.renderTools();
	}

	private toggleTool(toolId: string): void {
		const tool = this.tools.find(t => t.id === toolId);
		if (tool) {
			this.toolManager.setToolEnabled(toolId, !tool.isEnabled);
			tool.isEnabled = !tool.isEnabled;
			this.renderTools();
		}
	}

	private executeTool(toolId: string): void {
		// TODO: Show execute dialog
	}

	private showToolDetails(tool: IToolExplorerEntry): void {
		// TODO: Show tool details panel
	}

	public override dispose(): void {
		this._register.dispose();
		super.dispose();
	}
}

import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
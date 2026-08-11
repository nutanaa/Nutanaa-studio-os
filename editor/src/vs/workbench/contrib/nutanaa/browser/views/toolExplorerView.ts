/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { append, $, clearNode, addStandardDisposableListener } from '../../../../../base/browser/dom.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IViewDescriptorService } from '../../../../common/views.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { FilterViewPane, IFilterViewPaneOptions } from '../../../../browser/parts/views/viewPane.js';
import { IToolExplorerEntry, IToolExplorerFilter } from '../../models/studioModel.js';
import { IToolManager } from '../../common/tools/toolManager.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';

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
export class ToolExplorerView extends FilterViewPane {

	private container!: HTMLElement;
	private toolFilterContainer!: HTMLElement;
	private searchContainer!: HTMLElement;
	private listContainer!: HTMLElement;

	private tools: IToolExplorerEntry[] = [];
	private filter: IToolExplorerFilter = {};
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
		@IToolManager private readonly toolManager: IToolManager,
		@ILogService logService: ILogService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		this.container = container;
	}

	protected layoutBodyContent(height: number, width: number): void {
		this.container.classList.add('nutanaa-tool-explorer');

		this.renderFilterBar();
		this.renderSearchBar();
		this.renderToolList();

		this.loadTools();
	}

	private renderFilterBar(): void {
		this.toolFilterContainer = append(this.container, $('.tool-filter'));

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
			const button = append(this.toolFilterContainer, $(`.filter-toggle${this.isCategoryFiltered(cat.category) ? ' active' : ''}`));
			button.title = cat.category;
			button.textContent = cat.icon;
			(button as HTMLElement).dataset.category = cat.category;

			this._register(addStandardDisposableListener(button as HTMLElement, 'click', () => {
				this.toggleCategoryFilter(cat.category);
			}));
		}


		const enabledToggle = append(this.toolFilterContainer, $('label.toggle-label'));
		const toggle = append(enabledToggle, $('input.toggle-input', { type: 'checkbox', checked: this.filter.enabledOnly }));
		this._register(addStandardDisposableListener(toggle as HTMLElement, 'change', () => {
			this.filter = { ...this.filter, enabledOnly: (toggle as HTMLInputElement).checked };
			this.filterTools();
		}));
		append(enabledToggle, $('span.toggle-label', {}, localize('enabledOnly', 'Enabled Only')));

		const refreshButton = append(this.toolFilterContainer, $('button.refresh-button', {}, '⟳'));
		refreshButton.title = localize('refresh', 'Refresh');
		this._register(addStandardDisposableListener(refreshButton as HTMLElement, 'click', () => {
			this.loadTools();
		}));
	}

	private renderSearchBar(): void {
		this.searchContainer = append(this.container, $('.tool-search'));

		const searchInput = append(this.searchContainer, $('input.search-input', {
			placeholder: localize('searchTools', 'Search tools...'),
		}));
		this._register(addStandardDisposableListener(searchInput as HTMLElement, 'input', () => {
			this.searchQuery = (searchInput as HTMLInputElement).value;
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
			clearNode(this.listContainer);
			append(this.listContainer, $('div.empty-state', {}, localize('noTools', 'No tools to display')));
			return;
		}

		const fragment = document.createDocumentFragment();

		for (const tool of filtered) {
			const toolElement = this.createToolElement(tool);
			fragment.appendChild(toolElement);
		}

		clearNode(this.listContainer);
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


		// Description
		const description = append(content, $('span.tool-description', {}, tool.description));
		description.title = tool.description;

		// Permissions
		const permissions = append(element, $('.tool-permissions'));
		for (const perm of tool.permissions) {
			const permBadge = append(permissions, $('span.permission-badge', {}, perm));
			permBadge.title = this.getPermissionDescription(perm);
		}

		// Actions
		const actions = append(element, $('.tool-actions'));

		const toggleButton = append(actions, $('button.action-button' + (tool.isEnabled ? '' : ' disabled'), {}, tool.isEnabled ? 'Disable' : 'Enable'));
		this._register(addStandardDisposableListener(toggleButton as HTMLElement, 'click', () => {
			this.toggleTool(tool.id);
		}));

		const executeButton = append(actions, $('button.action-button', {}, '▶'));
		executeButton.title = localize('execute', 'Execute');
		this._register(addStandardDisposableListener(executeButton as HTMLElement, 'click', () => {
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
		const currentCategories = this.filter.categories || [];
		const index = currentCategories.indexOf(category);
		if (index >= 0) {
			this.filter = { ...this.filter, categories: currentCategories.filter(c => c !== category) };
		} else {
			this.filter = { ...this.filter, categories: [...currentCategories, category] };
		}

		this.updateFilterButtons();
		this.filterTools();
	}

	private updateFilterButtons(): void {
		const buttons = this.toolFilterContainer.querySelectorAll('.filter-toggle');
		buttons.forEach(btn => {
			const category = (btn as HTMLElement).dataset.category || '';
			(btn as HTMLElement).classList.toggle('active', this.isCategoryFiltered(category));
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

	private getPermissionDescription(permission: string): string {
		const descriptions: Record<string, string> = {
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
		const toolIndex = this.tools.findIndex(t => t.id === toolId);
		if (toolIndex >= 0) {
			const tool = this.tools[toolIndex];
			const updatedTool = { ...tool, isEnabled: !tool.isEnabled };
			this.toolManager.setToolEnabled(toolId, updatedTool.isEnabled);
			this.tools[toolIndex] = updatedTool;
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
		super.dispose();
	}
}

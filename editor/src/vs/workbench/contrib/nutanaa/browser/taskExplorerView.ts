/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ViewPane, IViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService, ITreeView, ITreeViewDataProvider, ITreeItem, TreeItemCollapsibleState } from '../../../common/views.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';

import { IThemeService } from '../../../../platform/theme/common/themeService.js';

import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { Emitter, Event } from '../../../../base/common/event.js';

import { Codicon } from '../../../../base/common/codicons.js';

export class TaskExplorerView extends ViewPane {
	private treeView!: ITreeView;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IHoverService hoverService: IHoverService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		const dataProvider = this.instantiationService.createInstance(TaskExplorerDataProvider); this.treeView.dataProvider = dataProvider;

	}
}

class TaskExplorerDataProvider implements ITreeViewDataProvider {
	private readonly _onDidChangeTreeData = new Emitter<ITreeItem[] | void>();
	readonly onDidChangeTreeData: Event<ITreeItem[] | void> = this._onDidChangeTreeData.event;

	async getChildren(element?: ITreeItem): Promise<ITreeItem[]> {
		if (!element) {
			return [
				{ handle: 'task-indexing', label: { label: 'Background Indexing Job' }, collapsibleState: TreeItemCollapsibleState.None, themeIcon: { id: Codicon.sync.id } },
				{ handle: 'task-embedding', label: { label: 'Embedding Vector Sync' }, collapsibleState: TreeItemCollapsibleState.None, themeIcon: { id: Codicon.cloudDownload.id } }
			];
		}
		return [];
	}

	public refresh(): void {
		this._onDidChangeTreeData.fire();
	}
}

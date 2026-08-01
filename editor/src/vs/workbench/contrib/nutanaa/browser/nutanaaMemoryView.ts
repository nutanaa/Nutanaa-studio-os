/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ViewPane, IViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';

import { IThemeService } from '../../../../platform/theme/common/themeService.js';

import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IWorkspaceMemoryService } from '../services/workspaceMemoryService.js';

export class NutanaaMemoryView extends ViewPane {
	private listContainer!: HTMLElement;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IWorkspaceMemoryService private readonly memoryService: IWorkspaceMemoryService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.listContainer = document.createElement('div');
		this.listContainer.className = 'nutanaa-memory-view-list';
		this.listContainer.style.padding = '10px';
		this.listContainer.style.overflowY = 'auto';

		container.appendChild(this.listContainer);
		this.refresh();
	}

	public refresh(): void {
		if (!this.listContainer) {
			return;
		}

		this.listContainer.innerHTML = '';
		const entries = this.memoryService.getAllEntries();

		if (entries.length === 0) {
			const emptyMsg = document.createElement('div');
			emptyMsg.textContent = 'No memory entries recorded.';
			emptyMsg.style.opacity = '0.6';
			this.listContainer.appendChild(emptyMsg);
			return;
		}

		for (const entry of entries) {
			const item = document.createElement('div');
			item.style.marginBottom = '8px';
			item.style.padding = '6px';
			item.style.border = '1px solid rgba(255,255,255,0.1)';
			item.style.borderRadius = '4px';

			const header = document.createElement('strong');
			header.textContent = `[${entry.type.toUpperCase()}] ${entry.key}`;
			item.appendChild(header);

			const content = document.createElement('p');
			content.style.margin = '4px 0 0 0';
			content.style.fontSize = '0.9em';
			content.textContent = entry.content;
			item.appendChild(content);

			this.listContainer.appendChild(item);
		}
	}
}

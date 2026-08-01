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

export interface IAgentMemoryItem {
	readonly key: string;
	readonly value: unknown;
	readonly scope: 'short_term' | 'long_term' | 'working';
	readonly updatedAt: number;
}

export class AgentMemoryView extends ViewPane {
	private containerEl!: HTMLElement;
	private memoryItems: IAgentMemoryItem[] = [];

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
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	public setMemoryItems(items: IAgentMemoryItem[]): void {
		this.memoryItems = items;
		this.renderMemory();
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this.containerEl = document.createElement('div');
		this.containerEl.style.padding = '12px';
		this.containerEl.style.fontFamily = 'var(--vscode-font-family)';
		container.appendChild(this.containerEl);
		this.renderMemory();
	}

	private renderMemory(): void {
		if (!this.containerEl) {
			return;
		}
		this.containerEl.innerHTML = '';

		const title = document.createElement('h3');
		title.textContent = 'Agent Memory Store';
		title.style.marginTop = '0';
		this.containerEl.appendChild(title);

		if (this.memoryItems.length === 0) {
			const empty = document.createElement('div');
			empty.textContent = 'Memory store is empty.';
			empty.style.opacity = '0.7';
			this.containerEl.appendChild(empty);
			return;
		}

		for (const m of this.memoryItems) {
			const card = document.createElement('div');
			card.style.border = '1px solid var(--vscode-widget-border)';
			card.style.borderRadius = '4px';
			card.style.padding = '8px';
			card.style.marginBottom = '8px';

			card.innerHTML = `
				<div><strong>Key:</strong> ${m.key} <span style="font-size: 0.8em; opacity: 0.7;">(${m.scope})</span></div>
				<pre style="margin: 4px 0 0 0; font-size: 0.85em; background: var(--vscode-textCodeBlock-background); padding: 4px; border-radius: 2px; overflow: auto;">${JSON.stringify(m.value, null, 2)}</pre>
			`;
			this.containerEl.appendChild(card);
		}
	}
}

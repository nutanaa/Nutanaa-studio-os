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
import { IAgentHistoryEntry } from '../models/agentHistoryModel.js';

export class AgentHistoryView extends ViewPane {
	private containerEl!: HTMLElement;
	private history: IAgentHistoryEntry[] = [];

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

	public setHistory(entries: IAgentHistoryEntry[]): void {
		this.history = entries;
		this.renderHistory();
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this.containerEl = document.createElement('div');
		this.containerEl.style.padding = '12px';
		this.containerEl.style.fontFamily = 'var(--vscode-font-family)';
		container.appendChild(this.containerEl);
		this.renderHistory();
	}

	private renderHistory(): void {
		if (!this.containerEl) {
			return;
		}
		this.containerEl.innerHTML = '';

		const title = document.createElement('h3');
		title.textContent = 'Execution History';
		title.style.marginTop = '0';
		this.containerEl.appendChild(title);

		if (this.history.length === 0) {
			const empty = document.createElement('div');
			empty.textContent = 'No past executions recorded.';
			empty.style.opacity = '0.7';
			this.containerEl.appendChild(empty);
			return;
		}

		for (const entry of this.history) {
			const item = document.createElement('div');
			item.style.borderBottom = '1px solid var(--vscode-widget-border)';
			item.style.padding = '8px 0';

			item.innerHTML = `
				<div><strong>${entry.taskTitle}</strong> (${entry.status})</div>
				<div style="font-size: 0.85em; opacity: 0.8;">
					Agent: ${entry.agentId} | Duration: ${entry.endTime - entry.startTime}ms | Cost: $${entry.costUsd.toFixed(4)}
				</div>
			`;
			this.containerEl.appendChild(item);
		}
	}
}

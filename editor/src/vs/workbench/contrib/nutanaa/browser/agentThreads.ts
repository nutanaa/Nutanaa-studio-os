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

export interface IAgentThread {
	readonly threadId: string;
	readonly agentId: string;
	readonly topic: string;
	readonly messageCount: number;
	readonly lastActive: number;
}

export class AgentThreadsView extends ViewPane {
	private containerEl!: HTMLElement;
	private threads: IAgentThread[] = [];

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

	public setThreads(threads: IAgentThread[]): void {
		this.threads = threads;
		this.renderThreads();
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this.containerEl = document.createElement('div');
		this.containerEl.style.padding = '12px';
		this.containerEl.style.fontFamily = 'var(--vscode-font-family)';
		container.appendChild(this.containerEl);
		this.renderThreads();
	}

	private renderThreads(): void {
		if (!this.containerEl) {
			return;
		}
		this.containerEl.innerHTML = '';

		const title = document.createElement('h3');
		title.textContent = 'Active Agent Threads';
		title.style.marginTop = '0';
		this.containerEl.appendChild(title);

		if (this.threads.length === 0) {
			const empty = document.createElement('div');
			empty.textContent = 'No active conversation threads.';
			empty.style.opacity = '0.7';
			this.containerEl.appendChild(empty);
			return;
		}

		for (const t of this.threads) {
			const card = document.createElement('div');
			card.style.border = '1px solid var(--vscode-widget-border)';
			card.style.borderRadius = '4px';
			card.style.padding = '8px';
			card.style.marginBottom = '8px';

			card.innerHTML = `
				<div><strong>${t.topic}</strong></div>
				<div style="font-size: 0.85em; opacity: 0.8;">
					Agent: ${t.agentId} | Messages: ${t.messageCount} | Last Active: ${new Date(t.lastActive).toLocaleTimeString()}
				</div>
			`;
			this.containerEl.appendChild(card);
		}
	}
}

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
export interface IAgentLogEntry {
	readonly agentId: string;
	readonly level: 'info' | 'warn' | 'error';
	readonly message: string;
	readonly timestamp: number;
}

export class AgentLogsView extends ViewPane {
	private logContainer!: HTMLElement;

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

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this.logContainer = document.createElement('div');
		this.logContainer.style.backgroundColor = 'var(--vscode-terminal-background)';
		this.logContainer.style.color = 'var(--vscode-terminal-foreground)';
		this.logContainer.style.fontFamily = 'monospace';
		this.logContainer.style.padding = '8px';
		this.logContainer.style.height = '100%';
		this.logContainer.style.overflowY = 'auto';

		container.appendChild(this.logContainer);
	}

	public appendLog(entry: IAgentLogEntry): void {
		if (!this.logContainer) {
			return;
		}
		const el = document.createElement('div');
		const colorMap: Record<string, string> = {
			info: 'var(--vscode-terminal-foreground)',
			warn: 'var(--vscode-notificationsWarningIcon-foreground)',
			error: 'var(--vscode-notificationsErrorIcon-foreground)'
		};
		el.style.color = colorMap[entry.level] || 'var(--vscode-terminal-foreground)';
		el.textContent = `[${new Date(entry.timestamp).toLocaleTimeString()}] [${entry.agentId}] [${entry.level.toUpperCase()}] ${entry.message}`;
		this.logContainer.appendChild(el);
	}
}

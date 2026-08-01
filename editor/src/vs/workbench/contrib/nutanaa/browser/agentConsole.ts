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

export class AgentConsoleView extends ViewPane {
	private consoleOutput!: HTMLElement;

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
		this.consoleOutput = document.createElement('div');
		this.consoleOutput.style.backgroundColor = 'var(--vscode-terminal-background)';
		this.consoleOutput.style.color = 'var(--vscode-terminal-foreground)';
		this.consoleOutput.style.fontFamily = 'monospace';
		this.consoleOutput.style.padding = '8px';
		this.consoleOutput.style.height = '100%';
		this.consoleOutput.style.overflowY = 'auto';

		this.appendLog('[System] Agent Runtime Console Initialized');
		container.appendChild(this.consoleOutput);
	}

	public appendLog(message: string): void {
		if (!this.consoleOutput) {
			return;
		}
		const line = document.createElement('div');
		line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
		this.consoleOutput.appendChild(line);
	}
}

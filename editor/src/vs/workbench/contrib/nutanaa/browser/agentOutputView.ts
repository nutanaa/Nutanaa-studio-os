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

export class AgentOutputView extends ViewPane {
	private outputContainer!: HTMLElement;

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
		this.outputContainer = document.createElement('div');
		this.outputContainer.style.padding = '8px';
		this.outputContainer.style.fontFamily = 'monospace';
		this.outputContainer.style.height = '100%';
		this.outputContainer.style.overflowY = 'auto';
		this.outputContainer.style.backgroundColor = 'var(--vscode-editor-background)';
		this.outputContainer.style.color = 'var(--vscode-editor-foreground)';

		container.appendChild(this.outputContainer);
	}

	public setOutput(content: string): void {
		if (!this.outputContainer) {
			return;
		}
		this.outputContainer.textContent = content;
	}

	public appendOutput(content: string): void {
		if (!this.outputContainer) {
			return;
		}
		this.outputContainer.textContent += content + '\n';
	}
}

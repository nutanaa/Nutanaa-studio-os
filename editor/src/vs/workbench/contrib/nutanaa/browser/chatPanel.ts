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
import { append, $ } from '../../../../base/browser/dom.js';

export class ChatPanel extends ViewPane {
	private messageListContainer!: HTMLElement;
	private inputField!: HTMLTextAreaElement;

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
		container.style.display = 'flex';
		container.style.flexDirection = 'column';
		container.style.height = '100%';

		this.messageListContainer = append(container, $('.chat-messages-container'));
		this.messageListContainer.style.flex = '1';
		this.messageListContainer.style.overflowY = 'auto';
		this.messageListContainer.style.padding = '8px';

		const inputContainer = append(container, $('.chat-input-container'));
		inputContainer.style.padding = '8px';
		inputContainer.style.borderTop = '1px solid var(--vscode-widget-border)';

		this.inputField = append(inputContainer, $('textarea.chat-input')) as HTMLTextAreaElement;
		this.inputField.style.width = '100%';
		this.inputField.style.height = '60px';
		this.inputField.style.resize = 'none';
		this.inputField.placeholder = 'Ask Nutanaa AI Agent (Cmd+Enter to send)...';

		this.addMessage('Nutanaa Studio Agent initialized. Ready to generate, refactor, or test your code.', 'assistant');
	}

	public addMessage(text: string, sender: 'user' | 'assistant'): void {
		const msgNode = append(this.messageListContainer, $(`.chat-message.${sender}`));
		msgNode.style.marginBottom = '8px';
		msgNode.style.padding = '6px 10px';
		msgNode.style.borderRadius = '4px';
		msgNode.style.background = sender === 'user' ? 'var(--vscode-button-background)' : 'var(--vscode-editor-background)';
		msgNode.style.color = sender === 'user' ? 'var(--vscode-button-foreground)' : 'var(--vscode-editor-foreground)';
		msgNode.textContent = text;
	}
}

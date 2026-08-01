// src/vs/workbench/contrib/nutanaa/browser/nutanaaWelcomeView.ts

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

export class NutanaaWelcomeView extends ViewPane {
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
		const root = append(container, $('.nutanaa-welcome-pane'));
		root.style.padding = '16px';
		
		const title = append(root, $('h2'));
		title.textContent = 'Nutanaa AI Workbench';

		const desc = append(root, $('p'));
		desc.textContent = 'Active Engine: Claude 3.5 Sonnet / Local Multi-Agent Core';

		const actionsContainer = append(root, $('.quick-actions'));
		actionsContainer.style.marginTop = '12px';
		
		const startChatBtn = append(actionsContainer, $('button.monaco-button'));
		startChatBtn.textContent = 'Open AI Chat Panel';
		startChatBtn.style.padding = '6px 12px';
		startChatBtn.style.cursor = 'pointer';
	}
}
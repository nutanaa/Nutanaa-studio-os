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
import { append, $, clearNode } from '../../../../base/browser/dom.js';
import { localize } from '../../../../nls.js';
import { INutanaaRuntimeConnectionService, NutanaaRuntimeConnectionState } from '../common/nutanaa.js';

/**
 * The Nutanaa "Dashboard" view. Shows real connection state from
 * {@link INutanaaRuntimeConnectionService} — no hardcoded engine name or
 * fake status text. Re-renders whenever the connection state changes.
 */
export class NutanaaWelcomeView extends ViewPane {

	private bodyContainer: HTMLElement | undefined;

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
		@INutanaaRuntimeConnectionService private readonly runtimeConnectionService: INutanaaRuntimeConnectionService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this._register(this.runtimeConnectionService.onDidChangeState(() => this.renderStatus()));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this.bodyContainer = append(container, $('.nutanaa-welcome-pane'));
		this.bodyContainer.style.padding = '16px';
		this.renderStatus();
	}

	private renderStatus(): void {
		if (!this.bodyContainer) {
			return;
		}
		clearNode(this.bodyContainer);

		const title = append(this.bodyContainer, $('h2'));
		title.textContent = 'Nutanaa AI Workbench';

		const desc = append(this.bodyContainer, $('p'));
		desc.textContent = this.describeState(this.runtimeConnectionService.state);

		const actionsContainer = append(this.bodyContainer, $('.quick-actions'));
		actionsContainer.style.marginTop = '12px';

		const startChatBtn = append(actionsContainer, $('button.monaco-button'));
		startChatBtn.textContent = 'Open AI Chat Panel';
		startChatBtn.style.padding = '6px 12px';
		startChatBtn.style.cursor = 'pointer';
	}

	private describeState(state: NutanaaRuntimeConnectionState): string {
		switch (state) {
			case NutanaaRuntimeConnectionState.Connected:
				return localize('nutanaa.welcome.connected', "Runtime: Connected");
			case NutanaaRuntimeConnectionState.Connecting:
				return localize('nutanaa.welcome.connecting', "Runtime: Connecting…");
			case NutanaaRuntimeConnectionState.Error:
				return localize('nutanaa.welcome.error', "Runtime: Connection failed — is backend/api running?");
			case NutanaaRuntimeConnectionState.Disconnected:
			default:
				return localize('nutanaa.welcome.disconnected', "Runtime: Not connected");
		}
	}
}
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
import { IAgentStateService } from '../common/agentStateService.js';
import { IAgentState } from '../models/agentModel.js';

export class AgentInspectorView extends ViewPane {
	private containerEl!: HTMLElement;
	private selectedAgentId: string | undefined;

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
		@IAgentStateService private readonly stateService: IAgentStateService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	public selectAgent(agentId: string): void {
		this.selectedAgentId = agentId;
		this.renderInspector();
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this.containerEl = document.createElement('div');
		this.containerEl.style.padding = '12px';
		this.containerEl.style.fontFamily = 'var(--vscode-font-family)';
		container.appendChild(this.containerEl);

		this._register(this.stateService.onDidChangeAgentState(() => this.renderInspector()));
		this.renderInspector();
	}

	private renderInspector(): void {
		if (!this.containerEl) {
			return;
		}
		this.containerEl.innerHTML = '';

		const title = document.createElement('h3');
		title.textContent = 'Agent Inspector';
		title.style.marginTop = '0';
		this.containerEl.appendChild(title);

		if (!this.selectedAgentId) {
			const agents = this.stateService.getAllAgentStates();
			if (agents.length > 0) {
				this.selectedAgentId = agents[0].id;
			} else {
				const empty = document.createElement('div');
				empty.textContent = 'No agent selected or available for inspection.';
				empty.style.opacity = '0.7';
				this.containerEl.appendChild(empty);
				return;
			}
		}

		const agent = this.stateService.getAgentState(this.selectedAgentId);
		if (!agent) {
			const notFound = document.createElement('div');
			notFound.textContent = `Agent ${this.selectedAgentId} not found.`;
			this.containerEl.appendChild(notFound);
			return;
		}

		this.renderAgentDetails(agent);
	}

	private renderAgentDetails(agent: IAgentState): void {
		const pre = document.createElement('pre');
		pre.style.backgroundColor = 'var(--vscode-textCodeBlock-background)';
		pre.style.padding = '8px';
		pre.style.borderRadius = '4px';
		pre.style.overflow = 'auto';
		pre.textContent = JSON.stringify(agent, null, 2);
		this.containerEl.appendChild(pre);
	}
}

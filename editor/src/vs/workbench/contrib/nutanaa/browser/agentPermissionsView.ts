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
import { IAgentPermissionRequest } from '../models/agentModel.js';

export class AgentPermissionsView extends ViewPane {
	private containerEl!: HTMLElement;
	private pendingRequests: IAgentPermissionRequest[] = [];
	private onResolveCallback?: (requestId: string, approve: boolean) => void;

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

	public setRequests(requests: IAgentPermissionRequest[], onResolve?: (requestId: string, approve: boolean) => void): void {
		this.pendingRequests = requests;
		this.onResolveCallback = onResolve;
		this.renderPermissions();
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this.containerEl = document.createElement('div');
		this.containerEl.style.padding = '12px';
		this.containerEl.style.fontFamily = 'var(--vscode-font-family)';
		container.appendChild(this.containerEl);
		this.renderPermissions();
	}

	private renderPermissions(): void {
		if (!this.containerEl) {
			return;
		}
		this.containerEl.innerHTML = '';

		const title = document.createElement('h3');
		title.textContent = 'Pending Permission Requests';
		title.style.marginTop = '0';
		this.containerEl.appendChild(title);

		if (this.pendingRequests.length === 0) {
			const empty = document.createElement('div');
			empty.textContent = 'No pending permission requests.';
			empty.style.opacity = '0.7';
			this.containerEl.appendChild(empty);
			return;
		}

		for (const req of this.pendingRequests) {
			const card = document.createElement('div');
			card.style.border = '1px solid var(--vscode-widget-border)';
			card.style.borderRadius = '4px';
			card.style.padding = '8px';
			card.style.marginBottom = '8px';

			const details = document.createElement('div');
			details.innerHTML = `
				<div><strong>Agent:</strong> ${req.agentId}</div>
				<div><strong>Resource:</strong> ${req.resource}</div>
				<div><strong>Action:</strong> ${req.action}</div>
				<div><strong>Reason:</strong> ${req.reason}</div>
			`;
			card.appendChild(details);

			const btnContainer = document.createElement('div');
			btnContainer.style.marginTop = '8px';

			const approveBtn = document.createElement('button');
			approveBtn.textContent = 'Approve';
			approveBtn.style.marginRight = '8px';
			approveBtn.onclick = () => {
				if (this.onResolveCallback) {
					this.onResolveCallback(req.id, true);
				}
			};

			const rejectBtn = document.createElement('button');
			rejectBtn.textContent = 'Reject';
			rejectBtn.onclick = () => {
				if (this.onResolveCallback) {
					this.onResolveCallback(req.id, false);
				}
			};

			btnContainer.appendChild(approveBtn);
			btnContainer.appendChild(rejectBtn);
			card.appendChild(btnContainer);

			this.containerEl.appendChild(card);
		}
	}
}

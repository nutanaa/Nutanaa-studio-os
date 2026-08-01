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
import { IAgentHealthService } from '../common/agentHealthService.js';

export class AgentHealthView extends ViewPane {
	private containerEl!: HTMLElement;

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
		@IAgentHealthService private readonly healthService: IAgentHealthService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this.containerEl = document.createElement('div');
		this.containerEl.style.padding = '12px';
		this.containerEl.style.fontFamily = 'var(--vscode-font-family)';
		container.appendChild(this.containerEl);
		this.renderHealth();
	}

	public renderHealth(): void {
		if (!this.containerEl) {
			return;
		}
		this.containerEl.innerHTML = '';

		const title = document.createElement('h3');
		title.textContent = 'Agent System Health';
		title.style.marginTop = '0';
		this.containerEl.appendChild(title);

		const health = this.healthService.getSystemHealth();

		const statusBox = document.createElement('div');
		statusBox.style.padding = '8px';
		statusBox.style.borderRadius = '4px';
		statusBox.style.fontWeight = 'bold';
		statusBox.style.marginBottom = '12px';

		if (health.overallStatus === 'healthy') {
			statusBox.style.backgroundColor = 'rgba(0, 200, 0, 0.2)';
			statusBox.textContent = 'STATUS: HEALTHY';
		} else if (health.overallStatus === 'degraded') {
			statusBox.style.backgroundColor = 'rgba(200, 200, 0, 0.2)';
			statusBox.textContent = 'STATUS: DEGRADED';
		} else {
			statusBox.style.backgroundColor = 'rgba(200, 0, 0, 0.2)';
			statusBox.textContent = 'STATUS: CRITICAL';
		}

		this.containerEl.appendChild(statusBox);

		const details = document.createElement('div');
		details.innerHTML = `
			<div><strong>Active Agents:</strong> ${health.activeAgents}</div>
			<div><strong>Queue Latency:</strong> ${health.queueLatencyMs}ms</div>
			<div><strong>Failed Agents:</strong> ${health.failedAgentsCount}</div>
			<div><strong>Daily Cost:</strong> $${health.totalCostTodayUsd.toFixed(4)}</div>
		`;
		this.containerEl.appendChild(details);

		if (health.issues.length > 0) {
			const issuesTitle = document.createElement('h4');
			issuesTitle.textContent = 'Active Issues';
			this.containerEl.appendChild(issuesTitle);

			const issuesList = document.createElement('ul');
			for (const issue of health.issues) {
				const li = document.createElement('li');
				li.textContent = issue;
				issuesList.appendChild(li);
			}
			this.containerEl.appendChild(issuesList);
		}
	}
}

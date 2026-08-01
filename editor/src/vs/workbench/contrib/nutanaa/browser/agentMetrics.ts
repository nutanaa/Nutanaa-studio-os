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
import { IAgentMetricsService } from '../common/agentMetricsService.js';

export class AgentMetricsView extends ViewPane {
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
		@IAgentMetricsService private readonly metricsService: IAgentMetricsService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this.containerEl = document.createElement('div');
		this.containerEl.style.padding = '12px';
		this.containerEl.style.fontFamily = 'var(--vscode-font-family)';
		container.appendChild(this.containerEl);

		this.renderMetrics();
	}

	public renderMetrics(): void {
		if (!this.containerEl) {
			return;
		}
		this.containerEl.innerHTML = '';

		const title = document.createElement('h3');
		title.textContent = 'System Metrics';
		title.style.marginTop = '0';
		this.containerEl.appendChild(title);

		const metricsList = this.metricsService.getAllMetrics();
		if (metricsList.length === 0) {
			const empty = document.createElement('div');
			empty.textContent = 'No metrics recorded.';
			empty.style.opacity = '0.7';
			this.containerEl.appendChild(empty);
			return;
		}

		for (const m of metricsList) {
			const card = document.createElement('div');
			card.style.border = '1px solid var(--vscode-widget-border)';
			card.style.borderRadius = '4px';
			card.style.padding = '8px';
			card.style.marginBottom = '8px';

			card.innerHTML = `
				<div><strong>Agent:</strong> ${m.agentId}</div>
				<div><strong>Tasks Completed:</strong> ${m.completedTasks} | <strong>Failed:</strong> ${m.failedTasks}</div>
				<div><strong>Avg Time:</strong> ${m.avgExecutionTimeMs.toFixed(2)} ms</div>
				<div><strong>Tokens Used:</strong> ${m.totalTokensUsed}</div>
				<div><strong>Cost:</strong> $${m.totalCostUsd.toFixed(4)}</div>
			`;
			this.containerEl.appendChild(card);
		}
	}
}

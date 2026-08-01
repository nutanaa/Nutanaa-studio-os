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
import { KnowledgeGraphBuilder } from '../common/graph/knowledgeGraphBuilder.js';

export class NutanaaGraphView extends ViewPane {
	private graphContainer!: HTMLElement;

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

		this.graphContainer = document.createElement('div');
		this.graphContainer.className = 'nutanaa-graph-view-container';
		this.graphContainer.style.padding = '10px';
		this.graphContainer.style.fontFamily = 'monospace';

		container.appendChild(this.graphContainer);
		this.renderPlaceholderGraph();
	}

	public renderGraph(graphBuilder: KnowledgeGraphBuilder): void {
		if (!this.graphContainer) {
			return;
		}

		this.graphContainer.innerHTML = '';
		const data = graphBuilder.getGraphData();

		const summary = document.createElement('div');
		summary.innerHTML = `<strong>Knowledge Graph Overview</strong><br/>Nodes: ${data.nodes.length} | Edges: ${data.edges.length}`;
		this.graphContainer.appendChild(summary);

		const list = document.createElement('ul');
		list.style.paddingLeft = '15px';
		list.style.marginTop = '10px';

		for (const node of data.nodes.slice(0, 15)) {
			const li = document.createElement('li');
			li.textContent = `${node.type.toUpperCase()}: ${node.label}`;
			list.appendChild(li);
		}

		this.graphContainer.appendChild(list);
	}

	private renderPlaceholderGraph(): void {
		if (!this.graphContainer) {
			return;
		}
		this.graphContainer.textContent = 'Knowledge graph ready. Run workspace indexing to populate dependency relationships.';
	}
}

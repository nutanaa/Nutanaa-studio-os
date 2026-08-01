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

export interface ITimelineEvent {
	readonly id: string;
	readonly timestamp: number;
	readonly agentId: string;
	readonly title: string;
	readonly detail?: string;
	readonly type: 'info' | 'step' | 'error' | 'approval';
}

export class AgentTimelineView extends ViewPane {
	private containerEl!: HTMLElement;
	private events: ITimelineEvent[] = [];

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

	public addTimelineEvent(event: ITimelineEvent): void {
		this.events.push(event);
		this.renderTimeline();
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this.containerEl = document.createElement('div');
		this.containerEl.style.padding = '12px';
		this.containerEl.style.fontFamily = 'var(--vscode-font-family)';
		container.appendChild(this.containerEl);
		this.renderTimeline();
	}

	private renderTimeline(): void {
		if (!this.containerEl) {
			return;
		}
		this.containerEl.innerHTML = '';

		const title = document.createElement('h3');
		title.textContent = 'Execution Timeline';
		title.style.marginTop = '0';
		this.containerEl.appendChild(title);

		if (this.events.length === 0) {
			const empty = document.createElement('div');
			empty.textContent = 'No timeline events recorded.';
			empty.style.opacity = '0.7';
			this.containerEl.appendChild(empty);
			return;
		}

		const list = document.createElement('div');
		list.style.borderLeft = '2px solid var(--vscode-activityBar-activeBorder)';
		list.style.paddingLeft = '12px';

		for (const ev of this.events) {
			const item = document.createElement('div');
			item.style.marginBottom = '12px';

			const time = document.createElement('div');
			time.style.fontSize = '0.8em';
			time.style.opacity = '0.7';
			time.textContent = new Date(ev.timestamp).toLocaleTimeString();

			const eventTitle = document.createElement('div');
			eventTitle.style.fontWeight = 'bold';
			eventTitle.textContent = `[${ev.agentId}] ${ev.title}`;

			item.appendChild(time);
			item.appendChild(eventTitle);

			if (ev.detail) {
				const detail = document.createElement('div');
				detail.style.fontSize = '0.9em';
				detail.textContent = ev.detail;
				item.appendChild(detail);
			}

			list.appendChild(item);
		}

		this.containerEl.appendChild(list);
	}
}

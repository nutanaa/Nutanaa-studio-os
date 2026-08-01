/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { localize } from '../../../../nls.js';

import {
	IViewsRegistry,
	IViewContainersRegistry,
	Extensions as ViewExtensions
} from '../../../common/views.js';

import { NUTANAA_PANEL_CONTAINER_ID, NutanaaPanelId } from './constants.js';

import { ChatPanel } from './chatPanel.js';
import { LogsPanel } from './logsPanel.js';
import { EventsPanel } from './eventsPanel.js';
import { AgentMonitorPanel } from './agentMonitorPanel.js';
import { WorkflowMonitorPanel } from './workflowMonitorPanel.js';
import { ProviderStatusPanel } from './providerStatusPanel.js';

export class NutanaaPanelViewsContribution extends Disposable {

	constructor() {
		super();
		this.registerPanels();
	}

	private registerPanels(): void {

		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

		const containersRegistry = Registry.as<IViewContainersRegistry>(
			ViewExtensions.ViewContainersRegistry
		);

		const container = containersRegistry.get(NUTANAA_PANEL_CONTAINER_ID);

		if (!container) {
			return;
		}

		viewsRegistry.registerViews([
			{
				id: NutanaaPanelId.Chat,
				name: { value: localize('nutanaaChat', 'Chat'), original: 'Chat' },
				ctorDescriptor: new SyncDescriptor(ChatPanel),
				canToggleVisibility: true,
				order: 1
			},
			{
				id: NutanaaPanelId.Logs,
				name: { value: localize('nutanaaLogs', 'Runtime Logs'), original: 'Runtime Logs' },
				ctorDescriptor: new SyncDescriptor(LogsPanel),
				canToggleVisibility: true,
				order: 2
			},
			{
				id: NutanaaPanelId.Events,
				name: { value: localize('nutanaaEvents', 'Event Stream'), original: 'Event Stream' },
				ctorDescriptor: new SyncDescriptor(EventsPanel),
				canToggleVisibility: true,
				order: 3
			},
			{
				id: NutanaaPanelId.AgentMonitor,
				name: { value: localize('nutanaaAgentMonitor', 'Agent Monitor'), original: 'Agent Monitor' },
				ctorDescriptor: new SyncDescriptor(AgentMonitorPanel),
				canToggleVisibility: true,
				order: 4
			},
			{
				id: NutanaaPanelId.WorkflowMonitor,
				name: { value: localize('nutanaaWorkflowMonitor', 'Workflow Monitor'), original: 'Workflow Monitor' },
				ctorDescriptor: new SyncDescriptor(WorkflowMonitorPanel),
				canToggleVisibility: true,
				order: 5
			},
			{
				id: NutanaaPanelId.ProviderStatus,
				name: { value: localize('nutanaaProviderStatus', 'Provider Dashboard'), original: 'Provider Dashboard' },
				ctorDescriptor: new SyncDescriptor(ProviderStatusPanel),
				canToggleVisibility: true,
				order: 6
			}
		], container);
	}
}

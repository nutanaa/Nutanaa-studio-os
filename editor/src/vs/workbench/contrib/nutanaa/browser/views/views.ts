/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as ViewContainerExtensions, IViewDescriptor, IViewContainersRegistry, ViewContainerLocation } from '../../../common/views.js';
import { ChatView } from './chatView.js';
import { AgentMonitorView } from './agentMonitorView.js';
import { WorkflowDesignerView } from './workflowDesignerView.js';
import { TimelineView } from './timelineView.js';
import { LogsView } from './logsView.js';
import { DashboardView } from './dashboardView.js';
import { ProviderExplorerView } from './providerExplorerView.js';
import { MemoryExplorerView } from './memoryExplorerView.js';
import { ToolExplorerView } from './toolExplorerView.js';
import { NotificationsView } from './notificationsView.js';

/**
 * View IDs for Nutanaa Studio OS
 */
export const NUTANAA_CHAT_VIEW_ID = 'workbench.contrib.nutanaa.chat';
export const NUTANAA_AGENTS_VIEW_ID = 'workbench.contrib.nutanaa.agents';
export const NUTANAA_WORKFLOWS_VIEW_ID = 'workbench.contrib.nutanaa.workflows';
export const NUTANAA_TIMELINE_VIEW_ID = 'workbench.contrib.nutanaa.timeline';
export const NUTANAA_LOGS_VIEW_ID = 'workbench.contrib.nutanaa.logs';
export const NUTANAA_DASHBOARD_VIEW_ID = 'workbench.contrib.nutanaa.dashboard';
export const NUTANAA_PROVIDERS_VIEW_ID = 'workbench.contrib.nutanaa.providers';
export const NUTANAA_MEMORY_VIEW_ID = 'workbench.contrib.nutanaa.memory';
export const NUTANAA_TOOLS_VIEW_ID = 'workbench.contrib.nutanaa.tools';
export const NUTANAA_NOTIFICATIONS_VIEW_ID = 'workbench.contrib.nutanaa.notifications';

/**
 * Nutanaa Studio OS View Descriptors
 */
export const nutanaaViews: IViewDescriptor[] = [
	{
		id: NUTANAA_DASHBOARD_VIEW_ID,
		name: 'Dashboard',
		ctorDescriptor: DashboardView,
		order: 0,
		weight: 0,
		collapsed: false,
		hideByDefault: false,
	},
	{
		id: NUTANAA_CHAT_VIEW_ID,
		name: 'AI Chat',
		ctorDescriptor: ChatView,
		order: 1,
		weight: 1,
		collapsed: false,
		hideByDefault: false,
	},
	{
		id: NUTANAA_AGENTS_VIEW_ID,
		name: 'Agents',
		ctorDescriptor: AgentMonitorView,
		order: 2,
		weight: 2,
		collapsed: false,
		hideByDefault: false,
	},
	{
		id: NUTANAA_WORKFLOWS_VIEW_ID,
		name: 'Workflows',
		ctorDescriptor: WorkflowDesignerView,
		order: 3,
		weight: 3,
		collapsed: false,
		hideByDefault: false,
	},
	{
		id: NUTANAA_TIMELINE_VIEW_ID,
		name: 'Timeline',
		ctorDescriptor: TimelineView,
		order: 4,
		weight: 4,
		collapsed: false,
		hideByDefault: false,
	},
	{
		id: NUTANAA_LOGS_VIEW_ID,
		name: 'Logs',
		ctorDescriptor: LogsView,
		order: 5,
		weight: 5,
		collapsed: false,
		hideByDefault: false,
	},
	{
		id: NUTANAA_PROVIDERS_VIEW_ID,
		name: 'Providers',
		ctorDescriptor: ProviderExplorerView,
		order: 6,
		weight: 6,
		collapsed: false,
		hideByDefault: false,
	},
	{
		id: NUTANAA_MEMORY_VIEW_ID,
		name: 'Memory',
		ctorDescriptor: MemoryExplorerView,
		order: 7,
		weight: 7,
		collapsed: false,
		hideByDefault: false,
	},
	{
		id: NUTANAA_TOOLS_VIEW_ID,
		name: 'Tools',
		ctorDescriptor: ToolExplorerView,
		order: 8,
		weight: 8,
		collapsed: false,
		hideByDefault: false,
	},
	{
		id: NUTANAA_NOTIFICATIONS_VIEW_ID,
		name: 'Notifications',
		ctorDescriptor: NotificationsView,
		order: 9,
		weight: 9,
		collapsed: false,
		hideByDefault: false,
	},
];

/**
 * Register all Nutanaa views
 */
export function registerNutanaaViews(): void {
	const container = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry)
		.registerViewContainer(
			{
				id: 'workbench.contrib.nutanaa.container',
				title: 'Nutanaa',
			},
			ViewContainerLocation.Sidebar
		);

	for (const viewDescriptor of nutanaaViews) {
		Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry)
			.registerViewDescriptor(viewDescriptor);
	}
}
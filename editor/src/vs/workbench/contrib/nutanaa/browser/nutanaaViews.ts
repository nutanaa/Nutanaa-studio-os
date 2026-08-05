/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize2 } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { TreeView, TreeViewPane } from '../../../browser/parts/views/treeView.js';
import {
	Extensions as ViewExtensions,
	ITreeViewDescriptor,
	IViewsRegistry,
	ViewContainer,
} from '../../../common/views.js';

import {
	NUTANAA_AGENT_EXPLORER_REFRESH_COMMAND_ID,
	NUTANAA_AGENT_EXPLORER_VIEW_ID,
} from '../common/nutanaa.js';

import { IRuntimeStateService } from '../common/runtimeState.js';
import { nutanaaRefreshIcon } from './nutanaaIcons.js';
import { NutanaaViewId } from './constants.js';

// Phase 4 Studio Views (Unified Implementations)
import { ChatView } from './views/chatView.js';
import { AgentMonitorView } from './views/agentMonitorView.js';
import { WorkflowDesignerView } from './views/workflowDesignerView.js';
import { TimelineView } from './views/timelineView.js';
import { LogsView } from './views/logsView.js';
import { DashboardView } from './views/dashboardView.js';
import { ProviderExplorerView } from './views/providerExplorerView.js';
import { MemoryExplorerView } from './views/memoryExplorerView.js';
import { ToolExplorerView } from './views/toolExplorerView.js';
import { NotificationsView } from './views/notificationsView.js';

/**
 * NutanaaViews - Single registration point for all Nutanaa Studio UI.
 *
 * Architecture:
 * - All views registered here in registerNutanaaViews()
 * - No duplicate registrations
 * - No legacy TreeView duplicates
 * - All views wired to RuntimeStateService
 *
 * State Flow:
 *   FastAPI → RuntimeConnectionService → RuntimeCoordinator → RuntimeStateService → Views
 */
export class NutanaaViews extends Disposable {

	constructor(
		container: ViewContainer,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IRuntimeStateService _stateService: IRuntimeStateService,
	) {
		super();
		// _stateService is injected to ensure IRuntimeStateService is alive
		// before any data provider tries to subscribe to it.
		void _stateService;

		// Register all Nutanaa views - single registration point
		this.registerNutanaaViews(container);
	}

	/**
	 * Register all Nutanaa Studio views.
	 * This is the ONLY place where Nutanaa views are registered.
	 */
	private registerNutanaaViews(container: ViewContainer): void {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

		// ── Phase 4 Studio Views ─────────────────────────────────────────────────
		// Professional production-ready views with full RuntimeStateService integration

		// Dashboard - Professional AI OS Dashboard
		viewsRegistry.registerViews([{
			id: 'workbench.contrib.nutanaa.dashboard',
			name: localize2('nutanaa.dashboard.title', 'Dashboard'),
			ctorDescriptor: new SyncDescriptor(DashboardView),
			canToggleVisibility: true,
			canMoveView: true,
			collapsed: false,
			order: 1,
		}], container);

		// Chat - Professional AI Chat Panel
		viewsRegistry.registerViews([{
			id: 'workbench.contrib.nutanaa.chat',
			name: localize2('nutanaa.chat.title', 'AI Chat'),
			ctorDescriptor: new SyncDescriptor(ChatView),
			canToggleVisibility: true,
			canMoveView: true,
			collapsed: false,
			order: 2,
		}], container);

		// Agent Monitor - Live Agent Tracking
		viewsRegistry.registerViews([{
			id: 'workbench.contrib.nutanaa.agents',
			name: localize2('nutanaa.agents.title', 'Agent Monitor'),
			ctorDescriptor: new SyncDescriptor(AgentMonitorView),
			canToggleVisibility: true,
			canMoveView: true,
			collapsed: false,
			order: 3,
		}], container);

		// Workflow Designer - Node-based Workflow Editor
		viewsRegistry.registerViews([{
			id: 'workbench.contrib.nutanaa.workflows',
			name: localize2('nutanaa.workflows.title', 'Workflow Designer'),
			ctorDescriptor: new SyncDescriptor(WorkflowDesignerView),
			canToggleVisibility: true,
			canMoveView: true,
			collapsed: false,
			order: 4,
		}], container);

		// Timeline - Runtime Event Timeline
		viewsRegistry.registerViews([{
			id: 'workbench.contrib.nutanaa.timeline',
			name: localize2('nutanaa.timeline.title', 'Timeline'),
			ctorDescriptor: new SyncDescriptor(TimelineView),
			canToggleVisibility: true,
			canMoveView: true,
			collapsed: false,
			order: 5,
		}], container);

		// Logs - Runtime Logs
		viewsRegistry.registerViews([{
			id: 'workbench.contrib.nutanaa.logs',
			name: localize2('nutanaa.logs.title', 'Logs'),
			ctorDescriptor: new SyncDescriptor(LogsView),
			canToggleVisibility: true,
			canMoveView: true,
			collapsed: false,
			order: 6,
		}], container);

		// Provider Explorer - AI Provider Management
		viewsRegistry.registerViews([{
			id: 'workbench.contrib.nutanaa.providers',
			name: localize2('nutanaa.providers.title', 'Providers'),
			ctorDescriptor: new SyncDescriptor(ProviderExplorerView),
			canToggleVisibility: true,
			canMoveView: true,
			collapsed: false,
			order: 7,
		}], container);

		// Memory Explorer - Memory Management
		viewsRegistry.registerViews([{
			id: 'workbench.contrib.nutanaa.memory',
			name: localize2('nutanaa.memory.title', 'Memory'),
			ctorDescriptor: new SyncDescriptor(MemoryExplorerView),
			canToggleVisibility: true,
			canMoveView: true,
			collapsed: false,
			order: 8,
		}], container);

		// Tool Explorer - Tool Management
		viewsRegistry.registerViews([{
			id: 'workbench.contrib.nutanaa.tools',
			name: localize2('nutanaa.tools.title', 'Tools'),
			ctorDescriptor: new SyncDescriptor(ToolExplorerView),
			canToggleVisibility: true,
			canMoveView: true,
			collapsed: false,
			order: 9,
		}], container);

		// Notifications - Runtime Notifications
		viewsRegistry.registerViews([{
			id: 'workbench.contrib.nutanaa.notifications',
			name: localize2('nutanaa.notifications.title', 'Notifications'),
			ctorDescriptor: new SyncDescriptor(NotificationsView),
			canToggleVisibility: true,
			canMoveView: true,
			collapsed: false,
			order: 10,
		}], container);

		// ── TreeView-based Explorers (Unified with Data Providers) ─────────────────
		// These use TreeView for compatibility with VS Code's explorer pattern

		// Agent Explorer - Tree-based agent view
		this.registerAgentExplorerView(container, viewsRegistry);

		// Workflow Explorer - Tree-based workflow view
		this.registerTreeViewExplorer(
			container, viewsRegistry,
			'workbench.views.nutanaa.workflowExplorer',
			localize2('nutanaa.workflowExplorer.title', 'Workflows'),
			'workflowExplorerDataProvider'
		);

		// Task Explorer - Tree-based task view
		this.registerTreeViewExplorer(
			container, viewsRegistry,
			'workbench.views.nutanaa.taskExplorer',
			localize2('nutanaa.taskExplorer.title', 'Tasks'),
			'taskExplorerDataProvider'
		);

		// Project Knowledge - Tree-based knowledge view
		this.registerTreeViewExplorer(
			container, viewsRegistry,
			'workbench.views.nutanaa.projectKnowledge',
			localize2('nutanaa.projectKnowledge.title', 'Project Knowledge'),
			'projectKnowledgeDataProvider'
		);

		// Project Explorer - Tree-based project view
		this.registerTreeViewExplorer(
			container, viewsRegistry,
			NutanaaViewId.ProjectExplorer,
			localize2('nutanaa.projectExplorer.title', 'Project'),
			'projectExplorerDataProvider'
		);
	}

	/**
	 * Register Agent Explorer with refresh action.
	 */
	private registerAgentExplorerView(container: ViewContainer, viewsRegistry: IViewsRegistry): void {
		const name = localize2('nutanaa.agentExplorer.title', 'Agents');

		const treeView = this._register(
			this.instantiationService.createInstance(TreeView, NUTANAA_AGENT_EXPLORER_VIEW_ID, name.value)
		);

		const dataProvider = this._register(
			this.instantiationService.createInstance(
				// Dynamic import to avoid circular dependencies
				() => import('./agentExplorerViewDataProvider.js').then(m => new m.AgentExplorerViewDataProvider())
			)
		);
		treeView.showRefreshAction = true;
		treeView.dataProvider = dataProvider;

		const descriptor: ITreeViewDescriptor = {
			id: NUTANAA_AGENT_EXPLORER_VIEW_ID,
			name,
			ctorDescriptor: new SyncDescriptor(TreeViewPane),
			canToggleVisibility: true,
			canMoveView: true,
			treeView,
			collapsed: false,
			order: 100,
		};
		viewsRegistry.registerViews([descriptor], container);

		// Refresh action
		this._register(registerAction2(class extends Action2 {
			constructor() {
				super({
					id: NUTANAA_AGENT_EXPLORER_REFRESH_COMMAND_ID,
					title: localize2('nutanaa.agentExplorer.refresh', 'Refresh Agents'),
					icon: nutanaaRefreshIcon,
					menu: {
						id: MenuId.ViewTitle,
						when: ContextKeyExpr.equals('view', NUTANAA_AGENT_EXPLORER_VIEW_ID),
						group: 'navigation',
					},
				});
			}
			run(): void { treeView.refresh(); }
		}));
	}

	/**
	 * Generic TreeView explorer registration.
	 */
	private registerTreeViewExplorer(
		container: ViewContainer,
		viewsRegistry: IViewsRegistry,
		viewId: string,
		name: ILocalizedString,
		dataProviderName: string
	): void {
		const treeView = this._register(
			this.instantiationService.createInstance(TreeView, viewId, name.value)
		);

		const dataProviderModule = dataProviderName.replace('DataProvider', '');

		let dataProviderPromise: Promise<unknown>;
		switch (dataProviderName) {
			case 'workflowExplorerDataProvider':
				dataProviderPromise = import('./workflowExplorerDataProvider.js').then(m => new m.WorkflowExplorerDataProvider());
				break;
			case 'taskExplorerDataProvider':
				dataProviderPromise = import('./taskExplorerDataProvider.js').then(m => new m.TaskExplorerDataProvider());
				break;
			case 'projectKnowledgeDataProvider':
				dataProviderPromise = import('./projectKnowledgeDataProvider.js').then(m => new m.ProjectKnowledgeDataProvider());
				break;
			case 'projectExplorerDataProvider':
				dataProviderPromise = import('./projectExplorerDataProvider.js').then(m => new m.ProjectExplorerDataProvider());
				break;
			default:
				dataProviderPromise = Promise.resolve();
		}

		dataProviderPromise.then(dp => {
			treeView.dataProvider = dp;
		});

		const descriptor: ITreeViewDescriptor = {
			id: viewId,
			name,
			ctorDescriptor: new SyncDescriptor(TreeViewPane),
			canToggleVisibility: true,
			canMoveView: true,
			treeView,
			collapsed: false,
			order: 100,
		};
		viewsRegistry.registerViews([descriptor], container);
	}
}

/**
 * Unified view registration function for Nutanaa Studio.
 * All Nutanaa views are registered through this single function.
 */
export function registerNutanaaViews(container: ViewContainer): void {
	// Views are now registered through NutanaaViews class
	// This function exists for compatibility and documentation purposes
}

// Import type for localization
import { ILocalizedString } from '../../../../nls.js';
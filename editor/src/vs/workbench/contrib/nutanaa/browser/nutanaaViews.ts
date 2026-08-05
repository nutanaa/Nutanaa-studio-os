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

import { AgentExplorerViewDataProvider } from './agentExplorerViewDataProvider.js';
import { WorkflowExplorerDataProvider } from './workflowExplorerDataProvider.js';
import { ProviderExplorerDataProvider } from './providerExplorerDataProvider.js';
import { MemoryExplorerDataProvider } from './memoryExplorerDataProvider.js';
import { TaskExplorerDataProvider } from './taskExplorerDataProvider.js';
import { ProjectKnowledgeDataProvider } from './projectKnowledgeDataProvider.js';
import { ChatDataProvider } from './chatDataProvider.js';
import { LogsDataProvider } from './logsDataProvider.js';
import { EventsDataProvider } from './eventsDataProvider.js';
import { NutanaaWelcomeView } from './nutanaaWelcomeView.js';
import { ProjectExplorerDataProvider } from './projectExplorerDataProvider.js';
import { nutanaaRefreshIcon } from './nutanaaIcons.js';
import { NutanaaViewId } from './constants.js';

export class NutanaaViews extends Disposable {

	constructor(
		container: ViewContainer,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IRuntimeStateService _stateService: IRuntimeStateService,
	) {
		super();
		// _stateService is injected to ensure IRuntimeStateService is alive
		// before any data provider tries to subscribe to it. The DI container
		// holds the singleton; individual data providers receive their own
		// injection via createInstance().
		void _stateService;

		this.registerAgentExplorerView(container);
		this.registerWorkflowExplorerView(container);
		this.registerProviderExplorerView(container);
		this.registerMemoryExplorerView(container);
		this.registerTaskExplorerView(container);
		this.registerProjectKnowledgeView(container);
		this.registerChatView(container);
		this.registerLogsView(container);
		this.registerEventsView(container);
		this.registerWelcomeDashboard(container);
		this.registerProjectExplorerView(container);
	}

	// ── Agent Explorer ─────────────────────────────────────────────────────

	private registerAgentExplorerView(container: ViewContainer): void {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const name = localize2('nutanaa.agentExplorer.title', 'Agents');

		const treeView = this._register(
			this.instantiationService.createInstance(TreeView, NUTANAA_AGENT_EXPLORER_VIEW_ID, name.value)
		);

		// AgentExplorerViewDataProvider owns its IRuntimeStateService subscriptions.
		const dataProvider = this._register(
			this.instantiationService.createInstance(AgentExplorerViewDataProvider)
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

	// ── Workflow Explorer ──────────────────────────────────────────────────

	private registerWorkflowExplorerView(container: ViewContainer): void {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const name = localize2('nutanaa.workflowExplorer.title', 'Workflow Explorer');

		const treeView = this._register(
			this.instantiationService.createInstance(
				TreeView, 'workbench.views.nutanaa.workflowExplorer', name.value
			)
		);
		treeView.dataProvider = this._register(
			this.instantiationService.createInstance(WorkflowExplorerDataProvider)
		);

		const descriptor: ITreeViewDescriptor = {
			id: 'workbench.views.nutanaa.workflowExplorer',
			name,
			ctorDescriptor: new SyncDescriptor(TreeViewPane),
			canToggleVisibility: true,
			canMoveView: true,
			treeView,
			collapsed: false,
			order: 101,
		};
		viewsRegistry.registerViews([descriptor], container);
	}

	// ── Provider Explorer ──────────────────────────────────────────────────

	private registerProviderExplorerView(container: ViewContainer): void {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const name = localize2('nutanaa.providerExplorer.title', 'Provider Explorer');

		const treeView = this._register(
			this.instantiationService.createInstance(
				TreeView, 'workbench.views.nutanaa.providerExplorer', name.value
			)
		);
		treeView.dataProvider = this._register(
			this.instantiationService.createInstance(ProviderExplorerDataProvider)
		);

		const descriptor: ITreeViewDescriptor = {
			id: 'workbench.views.nutanaa.providerExplorer',
			name,
			ctorDescriptor: new SyncDescriptor(TreeViewPane),
			canToggleVisibility: true,
			canMoveView: true,
			treeView,
			collapsed: false,
			order: 102,
		};
		viewsRegistry.registerViews([descriptor], container);
	}

	// ── Memory Explorer ────────────────────────────────────────────────────

	private registerMemoryExplorerView(container: ViewContainer): void {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const name = localize2('nutanaa.memoryExplorer.title', 'Memory Explorer');

		const treeView = this._register(
			this.instantiationService.createInstance(
				TreeView, 'workbench.views.nutanaa.memoryExplorer', name.value
			)
		);
		treeView.dataProvider = this._register(
			this.instantiationService.createInstance(MemoryExplorerDataProvider)
		);

		const descriptor: ITreeViewDescriptor = {
			id: 'workbench.views.nutanaa.memoryExplorer',
			name,
			ctorDescriptor: new SyncDescriptor(TreeViewPane),
			canToggleVisibility: true,
			canMoveView: true,
			treeView,
			collapsed: false,
			order: 103,
		};
		viewsRegistry.registerViews([descriptor], container);
	}

	// ── Task Explorer ──────────────────────────────────────────────────────

	private registerTaskExplorerView(container: ViewContainer): void {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const name = localize2('nutanaa.taskExplorer.title', 'Task Explorer');

		const treeView = this._register(
			this.instantiationService.createInstance(
				TreeView, 'workbench.views.nutanaa.taskExplorer', name.value
			)
		);
		treeView.dataProvider = this._register(
			this.instantiationService.createInstance(TaskExplorerDataProvider)
		);

		const descriptor: ITreeViewDescriptor = {
			id: 'workbench.views.nutanaa.taskExplorer',
			name,
			ctorDescriptor: new SyncDescriptor(TreeViewPane),
			canToggleVisibility: true,
			canMoveView: true,
			treeView,
			collapsed: false,
			order: 104,
		};
		viewsRegistry.registerViews([descriptor], container);
	}

	// ── Project Knowledge ──────────────────────────────────────────────────

	private registerProjectKnowledgeView(container: ViewContainer): void {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const name = localize2('nutanaa.projectKnowledge.title', 'Project Knowledge');

		const treeView = this._register(
			this.instantiationService.createInstance(
				TreeView, 'workbench.views.nutanaa.projectKnowledge', name.value
			)
		);
		treeView.dataProvider = this._register(
			this.instantiationService.createInstance(ProjectKnowledgeDataProvider)
		);

		const descriptor: ITreeViewDescriptor = {
			id: 'workbench.views.nutanaa.projectKnowledge',
			name,
			ctorDescriptor: new SyncDescriptor(TreeViewPane),
			canToggleVisibility: true,
			canMoveView: true,
			treeView,
			collapsed: false,
			order: 105,
		};
		viewsRegistry.registerViews([descriptor], container);
	}

	// ── Chat ───────────────────────────────────────────────────────────────

	private registerChatView(container: ViewContainer): void {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const name = localize2('nutanaa.chat.title', 'Chat');

		const treeView = this._register(
			this.instantiationService.createInstance(
				TreeView, 'workbench.views.nutanaa.chat', name.value
			)
		);
		treeView.dataProvider = this._register(
			this.instantiationService.createInstance(ChatDataProvider)
		);

		const descriptor: ITreeViewDescriptor = {
			id: 'workbench.views.nutanaa.chat',
			name,
			ctorDescriptor: new SyncDescriptor(TreeViewPane),
			canToggleVisibility: true,
			canMoveView: true,
			treeView,
			collapsed: false,
			order: 106,
		};
		viewsRegistry.registerViews([descriptor], container);
	}

	// ── Logs ───────────────────────────────────────────────────────────────

	private registerLogsView(container: ViewContainer): void {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const name = localize2('nutanaa.logs.title', 'Logs');

		const treeView = this._register(
			this.instantiationService.createInstance(
				TreeView, 'workbench.views.nutanaa.logs', name.value
			)
		);
		treeView.dataProvider = this._register(
			this.instantiationService.createInstance(LogsDataProvider)
		);

		const descriptor: ITreeViewDescriptor = {
			id: 'workbench.views.nutanaa.logs',
			name,
			ctorDescriptor: new SyncDescriptor(TreeViewPane),
			canToggleVisibility: true,
			canMoveView: true,
			treeView,
			collapsed: false,
			order: 107,
		};
		viewsRegistry.registerViews([descriptor], container);
	}

	// ── Events ─────────────────────────────────────────────────────────────

	private registerEventsView(container: ViewContainer): void {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const name = localize2('nutanaa.events.title', 'Events');

		const treeView = this._register(
			this.instantiationService.createInstance(
				TreeView, 'workbench.views.nutanaa.events', name.value
			)
		);
		treeView.dataProvider = this._register(
			this.instantiationService.createInstance(EventsDataProvider)
		);

		const descriptor: ITreeViewDescriptor = {
			id: 'workbench.views.nutanaa.events',
			name,
			ctorDescriptor: new SyncDescriptor(TreeViewPane),
			canToggleVisibility: true,
			canMoveView: true,
			treeView,
			collapsed: false,
			order: 108,
		};
		viewsRegistry.registerViews([descriptor], container);
	}

	// ── Welcome Dashboard ──────────────────────────────────────────────────

	private registerWelcomeDashboard(container: ViewContainer): void {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

		viewsRegistry.registerViews([{
			id: 'workbench.views.nutanaa.dashboard',
			name: localize2('nutanaa.dashboard.title', 'Dashboard'),
			ctorDescriptor: new SyncDescriptor(NutanaaWelcomeView),
			canToggleVisibility: true,
			canMoveView: true,
			collapsed: false,
			order: 1,
		}], container);
	}

	// ── Project Explorer ───────────────────────────────────────────────────

	private registerProjectExplorerView(container: ViewContainer): void {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const name = localize2('nutanaa.projectExplorer.title', 'Project Explorer');

		const treeView = this._register(
			this.instantiationService.createInstance(
				TreeView, NutanaaViewId.ProjectExplorer, name.value
			)
		);
		treeView.dataProvider = this._register(
			this.instantiationService.createInstance(ProjectExplorerDataProvider)
		);

		const descriptor: ITreeViewDescriptor = {
			id: NutanaaViewId.ProjectExplorer,
			name,
			ctorDescriptor: new SyncDescriptor(TreeViewPane),
			canToggleVisibility: true,
			canMoveView: true,
			treeView,
			collapsed: false,
			order: 109,
		};
		viewsRegistry.registerViews([descriptor], container);
	}
}

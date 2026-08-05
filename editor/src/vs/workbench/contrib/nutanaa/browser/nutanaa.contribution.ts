/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import {
	Extensions as ViewContainerExtensions,
	IViewContainersRegistry,
	ViewContainerLocation,
} from '../../../common/views.js';
import {
	IWorkbenchContribution,
	registerWorkbenchContribution2,
	WorkbenchPhase,
} from '../../../common/contributions.js';

// ── Phase 1 services ──────────────────────────────────────────────────────────

import {
	INutanaaRuntimeConnectionService,
	NUTANAA_VIEW_CONTAINER_ID,
} from '../common/nutanaa.js';
import { NutanaaRuntimeConnectionService } from './nutanaaRuntimeConnectionService.js';

import { IRuntimeEventBus, RuntimeEventBus } from '../common/runtimeEventBus.js';
import { IRuntimeStateService } from '../common/runtimeState.js';
import { RuntimeStateService } from './runtimeStateService.js';

// ── Phase 2 services ──────────────────────────────────────────────────────────

import { IAgentCoordinator, AgentCoordinator } from '../common/agentCoordinator.js';
import { ITaskScheduler } from '../common/taskScheduler.js';
import { TaskScheduler } from './taskScheduler.js';
import { IWorkflowEngine } from '../common/workflowEngine.js';
import { WorkflowEngine } from './workflowEngine.js';
import { IAgentDispatcher, AgentDispatcher } from '../services/agentDispatcher.js';

// ── Runtime coordinator ───────────────────────────────────────────────────────

import { IRuntimeCoordinator } from '../common/runtimeCoordinator.js';
import { RuntimeCoordinator } from './runtimeCoordinator.js';

// ── Phase 3 services ─────────────────────────────────────────────────────────

import { IProviderManager, ProviderManager } from '../common/providerManager.js';
import { IModelRegistry, ModelRegistry } from '../common/modelRegistry.js';
import { IPromptManager, PromptManager } from '../common/promptManager.js';
import { IContextBuilder, ContextBuilder } from '../common/contextBuilder.js';
import { IMemoryManager, MemoryManager } from '../common/memoryManager.js';
import { IEmbeddingManager, EmbeddingManager } from '../common/embeddingManager.js';
import { IToolManager, ToolManager } from '../common/toolManager.js';

// ── Views ─────────────────────────────────────────────────────────────────────

import { NutanaaViews } from './nutanaaViews.js';
import { nutanaaViewIcon } from './nutanaaIcons.js';

/*---------------------------------------------------------------------------------------------
 * Service Registration
 * Registration order matters: services with no constructor dependencies first;
 * services that inject others after their dependencies.
 *--------------------------------------------------------------------------------------------*/

// ── Phase 1 ───────────────────────────────────────────────────────────────────

registerSingleton(
	INutanaaRuntimeConnectionService,
	NutanaaRuntimeConnectionService,
	InstantiationType.Delayed
);

registerSingleton(
	IRuntimeEventBus,
	RuntimeEventBus,
	InstantiationType.Delayed
);

registerSingleton(
	IRuntimeStateService,
	RuntimeStateService,
	InstantiationType.Delayed
);

// ── Phase 2 ───────────────────────────────────────────────────────────────────

// AgentCoordinator has no injected service deps at construction time
// (dispatcher is wired post-construction via setDispatcher()).
registerSingleton(
	IAgentCoordinator,
	AgentCoordinator,
	InstantiationType.Delayed
);

// AgentDispatcher injects: IRuntimeEventBus, IRuntimeStateService, ILogService.
registerSingleton(
	IAgentDispatcher,
	AgentDispatcher,
	InstantiationType.Delayed
);

// TaskScheduler injects: IAgentCoordinator, IRuntimeEventBus, IRuntimeStateService, ILogService.
registerSingleton(
	ITaskScheduler,
	TaskScheduler,
	InstantiationType.Delayed
);

// WorkflowEngine injects: IAgentCoordinator, IRuntimeEventBus, IRuntimeStateService, ILogService.
registerSingleton(
	IWorkflowEngine,
	WorkflowEngine,
	InstantiationType.Delayed
);

// RuntimeCoordinator injects all Phase 2 services + wires the dispatcher.
registerSingleton(
	IRuntimeCoordinator,
	RuntimeCoordinator,
	InstantiationType.Delayed
);

// ── Phase 3 ───────────────────────────────────────────────────────────────────

// ProviderManager injects: IRuntimeEventBus, IRuntimeStateService, ILogService.
registerSingleton(
	IProviderManager,
	ProviderManager,
	InstantiationType.Delayed
);

// ModelRegistry injects: IRuntimeEventBus, IRuntimeStateService, ILogService.
registerSingleton(
	IModelRegistry,
	ModelRegistry,
	InstantiationType.Delayed
);

// PromptManager injects: IRuntimeEventBus, IRuntimeStateService, ILogService.
registerSingleton(
	IPromptManager,
	PromptManager,
	InstantiationType.Delayed
);

// ContextBuilder injects: IRuntimeEventBus, IRuntimeStateService, ILogService.
registerSingleton(
	IContextBuilder,
	ContextBuilder,
	InstantiationType.Delayed
);

// MemoryManager injects: IRuntimeEventBus, IRuntimeStateService, ILogService.
registerSingleton(
	IMemoryManager,
	MemoryManager,
	InstantiationType.Delayed
);

// EmbeddingManager injects: IRuntimeEventBus, IRuntimeStateService, ILogService.
registerSingleton(
	IEmbeddingManager,
	EmbeddingManager,
	InstantiationType.Delayed
);

// ToolManager injects: IRuntimeEventBus, IRuntimeStateService, ILogService.
registerSingleton(
	IToolManager,
	ToolManager,
	InstantiationType.Delayed
);

/*---------------------------------------------------------------------------------------------
 * Sidebar Registration
 *--------------------------------------------------------------------------------------------*/

const NUTANAA_VIEW_CONTAINER = Registry
	.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry)
	.registerViewContainer(
		{
			id: NUTANAA_VIEW_CONTAINER_ID,
			title: localize2('nutanaa', 'Nutanaa'),
			icon: nutanaaViewIcon,
			ctorDescriptor: new SyncDescriptor(
				ViewPaneContainer,
				[
					NUTANAA_VIEW_CONTAINER_ID,
					{ mergeViewWithContainerWhenSingleView: true },
				]
			),
			openCommandActionDescriptor: {
				id: NUTANAA_VIEW_CONTAINER_ID,
				mnemonicTitle: localize(
					{ key: 'miViewNutanaa', comment: ['&& denotes a mnemonic'] },
					'&&Nutanaa'
				),
				order: 10,
			},
			order: 10,
			alwaysUseContainerInfo: true,
		},
		ViewContainerLocation.Sidebar
	);

/*---------------------------------------------------------------------------------------------
 * Nutanaa Bootstrap
 *--------------------------------------------------------------------------------------------*/

class NutanaaContribution extends Disposable implements IWorkbenchContribution {

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,

		// Phase 1 — transport + state (must be alive before views render)
		@INutanaaRuntimeConnectionService
		runtimeConnectionService: INutanaaRuntimeConnectionService,

		@IRuntimeEventBus
		_runtimeEventBus: IRuntimeEventBus,

		@IRuntimeStateService
		_runtimeStateService: IRuntimeStateService,

		// Phase 2 — execution engine
		@IAgentCoordinator
		_agentCoordinator: IAgentCoordinator,

		@IAgentDispatcher
		_agentDispatcher: IAgentDispatcher,

		@ITaskScheduler
		_taskScheduler: ITaskScheduler,

		@IWorkflowEngine
		_workflowEngine: IWorkflowEngine,

		// Coordinator (constructs last; wires dispatcher inside its constructor)
		@IRuntimeCoordinator
		runtimeCoordinator: IRuntimeCoordinator,

		// Phase 3 — AI Core
		@IProviderManager
		_providerManager: IProviderManager,

		@IModelRegistry
		_modelRegistry: IModelRegistry,

		@IPromptManager
		_promptManager: IPromptManager,

		@IContextBuilder
		_contextBuilder: IContextBuilder,

		@IMemoryManager
		_memoryManager: IMemoryManager,

		@IEmbeddingManager
		_embeddingManager: IEmbeddingManager,

		@IToolManager
		_toolManager: IToolManager,
	) {
		super();

		// Force eager construction of every lazy singleton so subscribers
		// never miss the first event. The DI container owns all lifetimes.
		void _runtimeEventBus;
		void _runtimeStateService;
		void _agentCoordinator;
		void _agentDispatcher;
		void _taskScheduler;
		void _workflowEngine;
		void _providerManager;
		void _modelRegistry;
		void _promptManager;
		void _contextBuilder;
		void _memoryManager;
		void _embeddingManager;
		void _toolManager;

		// Create the Nutanaa sidebar and all registered tree views.
		this._register(
			instantiationService.createInstance(NutanaaViews, NUTANAA_VIEW_CONTAINER)
		);

		// Start the coordinator (fires onRuntimeReady, wires dispatcher).
		void runtimeCoordinator.start();

		// Establish HTTP + WebSocket connection to the Nutanaa Runtime backend.
		void runtimeConnectionService.connect();
	}
}

registerWorkbenchContribution2(
	'workbench.contrib.nutanaaViews',
	NutanaaContribution,
	WorkbenchPhase.AfterRestored
);

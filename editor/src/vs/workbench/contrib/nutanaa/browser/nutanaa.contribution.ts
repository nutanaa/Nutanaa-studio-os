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

// ── Phase 5 services ─────────────────────────────────────────────────────────

import { IAuthenticationManager, AuthenticationManager } from '../common/authenticationManager.js';
import { IAuthorizationManager, AuthorizationManager } from '../common/authorizationManager.js';
import { ISecretsManager, SecretsManager } from '../common/secretsManager.js';
import { IPluginManager, PluginManager } from '../common/pluginManager.js';
import { IMarketplaceService, MarketplaceService } from '../common/marketplaceService.js';
import { IRemoteAgentManager, RemoteAgentManager } from '../common/remoteAgentManager.js';
import { IDistributedRuntimeManager, DistributedRuntimeManager } from '../common/distributedRuntimeManager.js';
import { IOrganizationManager, OrganizationManager } from '../common/organizationManager.js';
import { IAuditManager, AuditManager } from '../common/auditManager.js';

// ── Phase 6 services ───────────────────────────────────────────────────────

import { ITelemetryManager, TelemetryManager } from '../common/telemetryManager.js';
import { IMetricsManager, MetricsManager } from '../common/metricsManager.js';
import { ITracingManager, TracingManager } from '../common/tracingManager.js';
import { ILoggingManager, LoggingManager } from '../common/loggingManager.js';
import { IPerformanceManager, PerformanceManager } from '../common/performanceManager.js';
import { ICacheManager, CacheManager } from '../common/cacheManager.js';
import { IOfflineManager, OfflineManager } from '../common/offlineManager.js';
import { IBackupManager, BackupManager } from '../common/backupManager.js';
import { IRecoveryManager, RecoveryManager } from '../common/recoveryManager.js';
import { IUpdateManager, UpdateManager } from '../common/updateManager.js';
import { IPackagingManager, PackagingManager } from '../common/packagingManager.js';
import { IConfigurationManager, ConfigurationManager } from '../common/configurationManager.js';
import { IHealthManager, HealthManager } from '../common/healthManager.js';

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

// ── Phase 5 ───────────────────────────────────────────────────────────────────

// AuthenticationManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	IAuthenticationManager,
	AuthenticationManager,
	InstantiationType.Delayed
);

// AuthorizationManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	IAuthorizationManager,
	AuthorizationManager,
	InstantiationType.Delayed
);

// SecretsManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	ISecretsManager,
	SecretsManager,
	InstantiationType.Delayed
);

// PluginManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	IPluginManager,
	PluginManager,
	InstantiationType.Delayed
);

// MarketplaceService injects: IPluginManager, IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	IMarketplaceService,
	MarketplaceService,
	InstantiationType.Delayed
);

// RemoteAgentManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	IRemoteAgentManager,
	RemoteAgentManager,
	InstantiationType.Delayed
);

// DistributedRuntimeManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	IDistributedRuntimeManager,
	DistributedRuntimeManager,
	InstantiationType.Delayed
);

// OrganizationManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	IOrganizationManager,
	OrganizationManager,
	InstantiationType.Delayed
);

// AuditManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	IAuditManager,
	AuditManager,
	InstantiationType.Delayed
);

// ── Phase 6 ───────────────────────────────────────────────────────────────────

// TelemetryManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	ITelemetryManager,
	TelemetryManager,
	InstantiationType.Delayed
);

// MetricsManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	IMetricsManager,
	MetricsManager,
	InstantiationType.Delayed
);

// TracingManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	ITracingManager,
	TracingManager,
	InstantiationType.Delayed
);

// LoggingManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	ILoggingManager,
	LoggingManager,
	InstantiationType.Delayed
);

// PerformanceManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	IPerformanceManager,
	PerformanceManager,
	InstantiationType.Delayed
);

// CacheManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	ICacheManager,
	CacheManager,
	InstantiationType.Delayed
);

// OfflineManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	IOfflineManager,
	OfflineManager,
	InstantiationType.Delayed
);

// BackupManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	IBackupManager,
	BackupManager,
	InstantiationType.Delayed
);

// RecoveryManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	IRecoveryManager,
	RecoveryManager,
	InstantiationType.Delayed
);

// UpdateManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	IUpdateManager,
	UpdateManager,
	InstantiationType.Delayed
);

// PackagingManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	IPackagingManager,
	PackagingManager,
	InstantiationType.Delayed
);

// ConfigurationManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	IConfigurationManager,
	ConfigurationManager,
	InstantiationType.Delayed
);

// HealthManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	IHealthManager,
	HealthManager,
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

		// Phase 5 — Enterprise Platform
		@IAuthenticationManager
		_authenticationManager: IAuthenticationManager,

		@IAuthorizationManager
		_authorizationManager: IAuthorizationManager,

		@ISecretsManager
		_secretsManager: ISecretsManager,

		@IPluginManager
		_pluginManager: IPluginManager,

		@IMarketplaceService
		_marketplaceService: IMarketplaceService,

		@IRemoteAgentManager
		_remoteAgentManager: IRemoteAgentManager,

		@IDistributedRuntimeManager
		_distributedRuntimeManager: IDistributedRuntimeManager,

		@IOrganizationManager
		_organizationManager: IOrganizationManager,

		@IAuditManager
		_auditManager: IAuditManager,

		// Phase 6 — Production Platform
		@ITelemetryManager
		_telemetryManager: ITelemetryManager,

		@IMetricsManager
		_metricsManager: IMetricsManager,

		@ITracingManager
		_tracingManager: ITracingManager,

		@ILoggingManager
		_loggingManager: ILoggingManager,

		@IPerformanceManager
		_performanceManager: IPerformanceManager,

		@ICacheManager
		_cacheManager: ICacheManager,

		@IOfflineManager
		_offlineManager: IOfflineManager,

		@IBackupManager
		_backupManager: IBackupManager,

		@IRecoveryManager
		_recoveryManager: IRecoveryManager,

		@IUpdateManager
		_updateManager: IUpdateManager,

		@IPackagingManager
		_packagingManager: IPackagingManager,

		@IConfigurationManager
		_configurationManager: IConfigurationManager,

		@IHealthManager
		_healthManager: IHealthManager,
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
		void _authenticationManager;
		void _authorizationManager;
		void _secretsManager;
		void _pluginManager;
		void _marketplaceService;
		void _remoteAgentManager;
		void _distributedRuntimeManager;
		void _organizationManager;
		void _auditManager;
		void _telemetryManager;
		void _metricsManager;
		void _tracingManager;
		void _loggingManager;
		void _performanceManager;
		void _cacheManager;
		void _offlineManager;
		void _backupManager;
		void _recoveryManager;
		void _updateManager;
		void _packagingManager;
		void _configurationManager;
		void _healthManager;

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

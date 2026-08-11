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
import { ILogService } from '../../../../platform/log/common/log.js';
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
import { NutanaaRuntimeConnectionService } from './runtime/nutanaaRuntimeConnectionService.js';

import { IRuntimeEventBus, RuntimeEventBus } from '../common/runtime/runtimeEventBus.js';
import { IRuntimeStateService } from '../common/runtime/runtimeState.js';
import { RuntimeStateService } from './runtimeStateService.js';

// ── Phase 2 services ──────────────────────────────────────────────────────────

import { IAgentCoordinator, AgentCoordinator } from '../common/agents/agentCoordinator.js';
import { IAgentDispatcher, AgentDispatcher } from './agents/agentDispatcher.js';
import { ITaskScheduler } from '../common/workflow/taskScheduler.js';
import { TaskScheduler } from './workflow/taskScheduler.js';
import { IWorkflowEngine } from '../common/workflow/workflowEngine.js';
import { WorkflowEngine } from './workflow/workflowEngine.js';

// ── Runtime coordinator ───────────────────────────────────────────────────────

import { IRuntimeCoordinator } from '../common/runtime/runtimeCoordinator.js';
import { RuntimeCoordinator } from './runtime/runtimeCoordinator.js';

// ── Phase 3 services ─────────────────────────────────────────────────────────

import { IProviderManager } from '../common/providers/providerManager.js';
import { IModelRegistry } from '../common/providers/modelRegistry.js';
import { IPromptManager } from '../common/tools/promptManager.js';
import { IContextBuilder } from '../common/memory/contextBuilder.js';
import { IMemoryManager } from '../common/memory/memoryManager.js';
import { IEmbeddingManager } from '../common/memory/embeddingManager.js';
import { IToolManager } from '../common/tools/toolManager.js';

import { ProviderManager } from './providers/providerManager.js';
import { ModelRegistry } from './providers/modelRegistry.js';
import { PromptManager } from './tools/promptManager.js';
import { ContextBuilder } from './memory/contextBuilder.js';
import { MemoryManager } from './memory/memoryManager.js';
import { EmbeddingManager } from './memory/embeddingManager.js';
import { ToolManager } from './tools/toolManager.js';

// ── Phase 5 services ─────────────────────────────────────────────────────────

import { IAuthenticationManager } from '../common/auth/authenticationManager.js';
import { IAuthorizationManager } from '../common/auth/authorizationManager.js';
import { ISecretsManager } from '../common/auth/secretsManager.js';
import { IPluginManager } from '../common/tools/pluginManager.js';
import { IMarketplaceService } from '../common/providers/marketplaceService.js';
import { IRemoteAgentManager } from '../common/agents/remoteAgentManager.js';
import { IDistributedRuntimeManager } from '../common/runtime/distributedRuntimeManager.js';
import { IOrganizationManager } from '../common/ops/organizationManager.js';
import { IAuditManager } from '../common/auth/auditManager.js';

import { AuthenticationManager } from './auth/authenticationManager.js';
import { AuthorizationManager } from './auth/authorizationManager.js';
import { SecretsManager } from './auth/secretsManager.js';
import { PluginManager } from './tools/pluginManager.js';
import { MarketplaceService } from './providers/marketplaceService.js';
import { RemoteAgentManager } from './agents/remoteAgentManager.js';
import { DistributedRuntimeManager } from './runtime/distributedRuntimeManager.js';
import { OrganizationManager } from './ops/organizationManager.js';
import { AuditManager } from './auth/auditManager.js';

// ── Phase 6 services ───────────────────────────────────────────────────────

import { ITelemetryManager } from '../common/ops/telemetryManager.js';
import { IMetricsManager } from '../common/ops/metricsManager.js';
import { ITracingManager } from '../common/ops/tracingManager.js';
import { ILoggingManager } from '../common/ops/loggingManager.js';
import { IPerformanceManager } from '../common/ops/performanceManager.js';
import { ICacheManager } from '../common/ops/cacheManager.js';
import { IOfflineManager } from '../common/ops/offlineManager.js';
import { IBackupManager } from '../common/ops/backupManager.js';
import { IRecoveryManager } from '../common/ops/recoveryManager.js';
import { IUpdateManager } from '../common/ops/updateManager.js';
import { IPackagingManager } from '../common/ops/packagingManager.js';
import { IConfigurationManager } from '../common/ops/configurationManager.js';
import { IHealthManager } from '../common/ops/healthManager.js';

import { TelemetryManager } from './ops/telemetryManager.js';
import { MetricsManager } from './ops/metricsManager.js';
import { TracingManager } from './ops/tracingManager.js';
import { LoggingManager } from './ops/loggingManager.js';
import { PerformanceManager } from './ops/performanceManager.js';
import { CacheManager } from './ops/cacheManager.js';
import { OfflineManager } from './ops/offlineManager.js';
import { BackupManager } from './ops/backupManager.js';
import { RecoveryManager } from './ops/recoveryManager.js';
import { UpdateManager } from './ops/updateManager.js';
import { PackagingManager } from './ops/packagingManager.js';
import { ConfigurationManager } from './ops/configurationManager.js';
import { HealthManager } from './ops/healthManager.js';

// ── Views ─────────────────────────────────────────────────────────────────────

import { NutanaaViews } from './nutanaaViews.js';
import { nutanaaViewIcon } from './nutanaaIcons.js';

/*---------------------------------------------------------------------------------------------
 * Helper function for DI casting
 *--------------------------------------------------------------------------------------------*/

// Cast a class to match the expected DI constructor signature
function diCast<T>(ctor: new (...args: any[]) => any): new (...args: any[]) => T {
	return ctor as new (...args: any[]) => T;
}

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

registerSingleton(
	ITaskScheduler,
	TaskScheduler,
	InstantiationType.Delayed
);

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
	MemoryManager as unknown as new (
		runtimeEventBus: IRuntimeEventBus,
		runtimeStateService: IRuntimeStateService,
		logService: ILogService
	) => IMemoryManager,
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
	diCast(AuthenticationManager),
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
	diCast(MarketplaceService),
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
	diCast<IBackupManager>(BackupManager),
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

// ConfigurationManager injects: IInstantiationService, ILogService, IStorageService, IRuntimeEventBus, IRuntimeStateService.
registerSingleton(
	IConfigurationManager,
	diCast<IConfigurationManager>(ConfigurationManager),
	InstantiationType.Delayed
);

// HealthManager injects: IRuntimeEventBus, IRuntimeStateService, IStorageService, ILogService.
registerSingleton(
	IHealthManager,
	diCast(HealthManager),
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
		_agentCoordinator.setDispatcher((req) => _agentDispatcher.dispatch(req));
		void runtimeCoordinator.start();

		// Establish HTTP + WebSocket connection to the Nutanaa Runtime backend.
		void runtimeConnectionService.connect();
	}
}

registerWorkbenchContribution2(
	'workbench.contrib.nutanaaViews',
	diCast(NutanaaContribution),
	WorkbenchPhase.AfterRestored
);
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Every event flowing through Nutanaa Runtime passes through the RuntimeEventBus.
 *
 * Nothing should communicate directly.
 *
 * RuntimeConnectionService
 * AgentCoordinator
 * ProviderManager
 * WorkflowManager
 * MemoryManager
 * UI Views
 * Logs
 *
 * all communicate using these event types.
 */

export const enum RuntimeEventType {

	/* Runtime */

	RuntimeConnected,

	RuntimeDisconnected,

	RuntimeConnecting,

	RuntimeReconnect,

	RuntimeError,

	/* Agents */

	AgentRegistered,

	AgentUnregistered,

	AgentQueued,

	AgentStarted,

	AgentRunning,

	AgentCompleted,

	AgentFailed,

	AgentCancelled,

	/* Providers */

	ProviderRegistered,

	ProviderRemoved,

	ProviderChanged,

	ProviderHealthy,

	ProviderUnhealthy,

	ProviderConnected,

	ProviderDisconnected,

	ProviderFailed,

	/* Prompts */

	PromptRendered,

	/* Embeddings */

	EmbeddingCreated,

	/* Tools */

	ToolStarted,

	ToolCompleted,

	ToolFailed,

	/* Workflows */

	WorkflowCreated,

	WorkflowStarted,

	WorkflowRunning,

	WorkflowCompleted,

	WorkflowFailed,

	WorkflowCancelled,

	/* Tasks */

	TaskQueued,

	TaskStarted,

	TaskCompleted,

	TaskFailed,

	TaskCancelled,

	/* Memory */

	MemoryUpdated,

	MemoryCleared,

	KnowledgeIndexed,

	/* Logs */

	Log,

	Warning,

	Error,

	/* UI */

	ViewChanged,

	PanelOpened,

	PanelClosed,

	SelectionChanged,

	/* Notifications */

	Notification,

	/*---------------------------------------------------------------------------------------------
	 * Phase 5 Enterprise Events
	 *--------------------------------------------------------------------------------------------*/

	/* Authentication */

	UserLoggedIn,

	UserLoggedOut,

	UserLoginFailed,

	/* Authorization */

	PermissionChanged,

	RoleAssigned,

	RoleRevoked,

	/* Secrets */

	SecretCreated,

	SecretUpdated,

	SecretDeleted,

	SecretAccessed,

	SecretRotated,

	/* Plugins */

	PluginInstalled,

	PluginRemoved,

	PluginLoaded,

	PluginUnloaded,

	PluginError,

	/* Marketplace */

	MarketplaceSearch,

	MarketplaceInstall,

	MarketplaceUpdate,

	/* Remote Agents */

	AgentConnected,

	AgentDisconnected,

	AgentHeartbeat,

	/* Distributed Runtime */

	NodeConnected,

	NodeDisconnected,

	MasterElected,

	FailoverTriggered,

	/* Organizations */

	OrganizationChanged,

	TeamCreated,

	TeamUpdated,

	TeamDeleted,

	MemberJoined,

	MemberLeft,

	/* Audit */

	AuditEvent,

	SecurityAlert,

	/*---------------------------------------------------------------------------------------------
	 * Phase 6 Production Events
	 *--------------------------------------------------------------------------------------------*/

	/* Telemetry */

	TelemetryEnabled,

	TelemetryDisabled,

	TelemetryEventSent,

	TelemetrySessionStarted,

	TelemetrySessionEnded,

	TelemetryOptIn,

	TelemetryOptOut,

	/* Metrics */

	MetricsUpdated,

	MetricsCollected,

	MetricsThresholdExceeded,

	/* Tracing */

	TraceStarted,

	TraceEnded,

	TraceSpanCreated,

	TraceExport,

	/* Logging */

	LogLevelChanged,

	LogEntryAdded,

	LogRotated,

	LogExported,

	/* Performance */

	PerformanceProfiled,

	SlowTaskDetected,

	MemoryProfile,

	CPUProfile,

	StartupComplete,

	/* Caching */

	CacheHit,

	CacheMiss,

	CacheEvicted,

	CacheCleared,

	CacheConfigured,

	/* Offline */

	OfflineModeChanged,

	OfflineRequestQueued,

	OfflineSynced,

	ConflictDetected,

	ConflictResolved,

	/* Backup */

	BackupStarted,

	BackupCompleted,

	BackupFailed,

	RestoreStarted,

	RestoreCompleted,

	RestoreFailed,

	SnapshotCreated,

	/* Recovery */

	CrashDetected,

	CrashRecovered,

	SessionRestored,

	WorkflowRecovered,

	TaskRecovered,

	AutoRestart,

	/* Updates */

	UpdateAvailable,

	UpdateDownloaded,

	UpdateInstalled,

	UpdateFailed,

	UpdateChecked,

	ChannelChanged,

	AutoUpdateChanged,

	/* Packaging */

	BuildStarted,

	BuildProgress,

	BuildCompleted,

	BuildFailed,

	BuildCancelled,

	InstallerGenerated,

	ArtifactVerified,

	ArtifactDeleted,

	/* Configuration */

	ConfigurationChanged,

	ProfileCreated,

	ProfileDeleted,

	ProfileSwitched,

	ConfigurationImported,

	ConfigurationExported,

	ConfigurationValidated,

	ConfigurationMigrated,

	ConfigurationReset,

	/* Health */

	HealthChanged,

	ReadinessChanged,

	LivenessChanged,

	ProviderHealthChanged,

	DependencyHealthChanged,

	HealthCheckCompleted
}

/**
 * Generic Runtime Event.
 */

export interface RuntimeEvent<T = unknown> {

	readonly type: RuntimeEventType;

	readonly timestamp: number;

	readonly payload: T;
}

/**
 * Agent Event Payload
 */

export interface AgentEvent {

	id: string;

	name: string;

	status: string;

	message?: string;
}

/**
 * Provider Event Payload
 */

export interface ProviderEvent {

	name: string;

	status: string;

	model?: string;

	healthy?: boolean;
}

/**
 * Workflow Event Payload
 */

export interface WorkflowEvent {

	id: string;

	name: string;

	state: string;
}

/**
 * Task Event Payload
 */

export interface TaskEvent {

	id: string;

	title: string;

	state: string;
}

/**
 * Log Event Payload
 */

export interface LogEvent {

	level: 'info' | 'warning' | 'error';

	message: string;

	source?: string;
}

/**
 * Notification Payload
 */

export interface NotificationEvent {

	title: string;

	message: string;
}

/**
 * Alias so that consumers that imported the I-prefixed name
 * (`IRuntimeEvent`) continue to compile without changes.
 */
export type IRuntimeEvent<T = unknown> = RuntimeEvent<T>;

/*---------------------------------------------------------------------------------------------
 * Phase 6 Production Event Payloads
 *--------------------------------------------------------------------------------------------*/

/**
 * Telemetry Event Payload
 */
export interface TelemetryEvent {
	eventName: string;
	properties?: Record<string, unknown>;
	duration?: number;
	anonymous?: boolean;
}

/**
 * Metrics Event Payload
 */
export interface MetricsEvent {
	cpu?: number;
	memory?: number;
	gpu?: number;
	disk?: number;
	network?: number;
	llmLatency?: number;
	toolLatency?: number;
	workflowLatency?: number;
	agentLatency?: number;
	tokenUsage?: number;
	threshold?: string;
	exceeded?: boolean;
}

/**
 * Tracing Event Payload
 */
export interface TracingEvent {
	traceId: string;
	spanId?: string;
	parentSpanId?: string;
	operation: string;
	duration?: number;
	metadata?: Record<string, unknown>;
}

/**
 * Logging Event Payload
 */
export interface LoggingEvent {
	level: 'debug' | 'info' | 'warning' | 'error';
	message: string;
	source?: string;
	logger?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Performance Event Payload
 */
export interface PerformanceEvent {
	type: 'startup' | 'memory' | 'cpu' | 'render' | 'slow_task' | 'frame_timing';
	duration?: number;
	details?: Record<string, unknown>;
	slowTaskThreshold?: number;
	actualDuration?: number;
}

/**
 * Cache Event Payload
 */
export interface CacheEvent {
	cacheType: 'memory' | 'disk' | 'embedding' | 'prompt' | 'tool' | 'http' | 'provider';
	key?: string;
	hit?: boolean;
	evicted?: boolean;
	entriesCleared?: number;
	config?: Record<string, unknown>;
}

/**
 * Offline Event Payload
 */
export interface OfflineEvent {
	isOffline: boolean;
	requestsQueued?: number;
	syncRequests?: number;
	conflict?: {
		local: unknown;
		remote: unknown;
		resolution: 'local' | 'remote' | 'merged';
	};
}

/**
 * Backup Event Payload
 */
export interface BackupEvent {
	type: 'workspace' | 'memory' | 'workflow' | 'configuration';
	backupId?: string;
	success: boolean;
	size?: number;
	error?: string;
	restoreId?: string;
	snapshotId?: string;
}

/**
 * Recovery Event Payload
 */
export interface RecoveryEvent {
	type: 'crash' | 'session' | 'workflow' | 'task' | 'agent';
	success: boolean;
	details?: Record<string, unknown>;
	autoRestart?: boolean;
}

/**
 * Update Event Payload
 */
export interface UpdateEvent {
	currentVersion: string;
	availableVersion?: string;
	channel?: 'stable' | 'preview' | 'nightly';
	downloadProgress?: number;
	error?: string;
	autoUpdate?: boolean;
}

/**
 * Packaging Event Payload
 */
export interface PackagingEvent {
	platform: 'windows' | 'linux' | 'darwin' | 'portable';
	progress: number;
	success: boolean;
	artifactId?: string;
	error?: string;
	cancelled?: boolean;
	installerType?: string;
}

/**
 * Configuration Event Payload
 */
export interface ConfigurationEvent {
	keys: string[];
	profile?: string;
	profileId?: string;
	profileName?: string;
	importWarnings?: string[];
	importErrors?: string[];
	exportData?: string;
	migratedKeys?: number;
}

/**
 * Health Event Payload
 */
export interface HealthEvent {
	overallStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
	changedComponents?: string[];
	checkName?: string;
	checkPassed?: boolean;
	checkDuration?: number;
}
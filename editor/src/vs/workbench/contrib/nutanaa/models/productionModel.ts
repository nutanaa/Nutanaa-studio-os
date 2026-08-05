/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Production Platform Model Types for Nutanaa Studio OS
 *
 * Defines all interfaces for telemetry, metrics, tracing, logging,
 * performance, caching, offline, backup, recovery, updates, and health.
 */

// ── Telemetry Types ─────────────────────────────────────────────────────────

export type TelemetryLevel = 'off' | 'minimal' | 'balanced' | 'detailed';

export interface ITelemetryEvent {
	readonly id: string;
	readonly name: string;
	readonly timestamp: number;
	readonly sessionId: string;
	readonly userId?: string;
	readonly properties: Record<string, unknown>;
	readonly measurements: Record<string, number>;
	readonly duration?: number;
}

export interface ITelemetryConfig {
	readonly level: TelemetryLevel;
	readonly userConsent: boolean;
	readonly machineId: string;
	readonly sessionId: string;
	readonly firstSessionDate: number;
	readonly lastSessionDate: number;
	readonly sessionCount: number;
	readonly enabledEvents: string[];
	readonly disabledEvents: string[];
}

export interface ITelemetrySummary {
	readonly totalEvents: number;
	readonly eventsByName: Map<string, number>;
	readonly eventsByType: Map<string, number>;
	readonly averageSessionDuration: number;
	readonly topEvents: Array<{ name: string; count: number }>;
}

// ── Metrics Types ───────────────────────────────────────────────────────────

export interface ISystemMetrics {
	readonly cpu: ICpuMetrics;
	readonly memory: IMemoryMetrics;
	readonly gpu: IGpuMetrics;
	readonly disk: IDiskMetrics;
	readonly network: INetworkMetrics;
	readonly timestamp: number;
}

export interface ICpuMetrics {
	readonly usage: number; // percentage 0-100
	readonly cores: number;
	readonly frequency: number; // MHz
	readonly temperature?: number;
	readonly processes: number;
}

export interface IMemoryMetrics {
	readonly used: number; // bytes
	readonly total: number;
	readonly available: number;
	readonly percentage: number;
	readonly heapUsed: number;
	readonly heapTotal: number;
	readonly external: number;
}

export interface IGpuMetrics {
	readonly usage: number;
	readonly memory: number;
	readonly temperature?: number;
}

export interface IDiskMetrics {
	readonly read: number; // bytes/sec
	readonly write: number; // bytes/sec
	readonly readCount: number;
	readonly writeCount: number;
	readonly usage: number; // percentage
}

export interface INetworkMetrics {
	readonly bytesIn: number;
	readonly bytesOut: number;
	readonly latency: number;
	readonly connectionCount: number;
}

export interface IPerformanceMetrics {
	readonly llmLatency: ILatencyMetrics;
	readonly toolLatency: ILatencyMetrics;
	readonly workflowLatency: ILatencyMetrics;
	readonly agentLatency: ILatencyMetrics;
	readonly queueStats: IQueueMetrics;
	readonly providerStats: IProviderMetrics;
	readonly tokenUsage: ITokenUsageMetrics;
}

export interface ILatencyMetrics {
	readonly average: number;
	readonly p50: number;
	readonly p95: number;
	readonly p99: number;
	readonly min: number;
	readonly max: number;
	readonly count: number;
}

export interface IQueueMetrics {
	readonly queued: number;
	readonly processing: number;
	readonly completed: number;
	readonly failed: number;
	readonly averageWaitTime: number;
}

export interface IProviderMetrics {
	readonly requests: number;
	readonly errors: number;
	readonly retries: number;
	readonly timeouts: number;
}

export interface ITokenUsageMetrics {
	readonly prompt: number;
	readonly completion: number;
	readonly total: number;
	readonly cost: number;
	readonly byProvider: Map<string, { prompt: number; completion: number; total: number; cost: number }>;
}

export interface IMetricsHistory {
	readonly system: ISystemMetrics[];
	readonly performance: IPerformanceMetrics[];
	readonly timestamp: number;
}

// ── Tracing Types ───────────────────────────────────────────────────────────

export interface ITraceSpan {
	readonly id: string;
	readonly traceId: string;
	readonly parentId: string | undefined;
	readonly name: string;
	readonly type: 'request' | 'workflow' | 'agent' | 'provider' | 'tool' | 'internal';
	readonly startTime: number;
	readonly endTime: number;
	readonly duration: number;
	readonly status: 'ok' | 'error' | 'cancelled';
	readonly attributes: Record<string, unknown>;
	readonly events: ITraceEvent[];
	readonly children: ITraceSpan[];
}

export interface ITraceEvent {
	readonly name: string;
	readonly timestamp: number;
	readonly attributes: Record<string, unknown>;
}

export interface ITrace {
	readonly id: string;
	readonly type: 'request' | 'workflow' | 'agent' | 'provider' | 'tool';
	 readonly rootSpan: ITraceSpan;
	 readonly spans: ITraceSpan[];
	 readonly startTime: number;
	 readonly endTime: number;
	 readonly status: 'ok' | 'error' | 'cancelled';
	 readonly correlationId: string;
}

export interface ITraceQuery {
	readonly startTime?: number;
	readonly endTime?: number;
	readonly type?: string;
	readonly traceId?: string;
	readonly correlationId?: string;
	readonly status?: string;
	readonly limit?: number;
}

// ── Logging Types ───────────────────────────────────────────────────────────

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface ILogEntry {
	readonly id: string;
	readonly timestamp: number;
	readonly level: LogLevel;
	readonly source: string;
	readonly message: string;
	readonly category: string;
	readonly context: ILogContext;
	readonly exception?: string;
	readonly stackTrace?: string;
}

export interface ILogContext {
	readonly sessionId: string;
	readonly requestId?: string;
	readonly traceId?: string;
	readonly userId?: string;
	readonly workspaceId?: string;
	readonly agentId?: string;
	readonly workflowId?: string;
}

export interface ILogConfig {
	readonly level: LogLevel;
	readonly maxSize: number; // bytes
	readonly maxFiles: number;
	readonly retention: number; // days
	readonly format: 'json' | 'text';
	readonly categories: Record<string, LogLevel>;
	 readonly output: ('console' | 'file' | 'remote')[];
}

export interface ILogQuery {
	readonly startTime?: number;
	readonly endTime?: number;
	readonly level?: LogLevel;
	readonly category?: string;
	readonly source?: string;
	readonly search?: string;
	readonly limit?: number;
	readonly offset?: number;
}

// ── Performance Types ───────────────────────────────────────────────────────

export interface IPerformanceProfile {
	readonly id: string;
	readonly name: string;
	readonly type: 'startup' | 'memory' | 'cpu' | 'rendering' | 'execution';
	readonly startTime: number;
	readonly endTime: number;
	readonly duration: number;
	readonly samples: IPerformanceSample[];
}

export interface IPerformanceSample {
	readonly timestamp: number;
	readonly type: string;
	readonly name: string;
	readonly duration: number;
	readonly memory: number;
	readonly cpu: number;
	readonly attributes: Record<string, unknown>;
}

export interface IRenderingPerformance {
	readonly frameCount: number;
	readonly averageFrameTime: number;
	readonly p95FrameTime: number;
	readonly droppedFrames: number;
	readonly fps: number;
}

export interface ISlowTaskDetection {
	readonly threshold: number;
	readonly tasks: Array<{
		id: string;
		name: string;
		duration: number;
		startedAt: number;
	}>;
}

// ── Cache Types ─────────────────────────────────────────────────────────────

export interface ICacheConfig {
	readonly maxSize: number;
	readonly ttl: number; // milliseconds
	readonly eviction: 'lru' | 'fifo' | 'lfu';
	readonly enabled: boolean;
}

export interface ICacheEntry<T = unknown> {
	readonly key: string;
	readonly value: T;
	readonly createdAt: number;
	readonly accessedAt: number;
	readonly expiresAt: number;
	readonly hitCount: number;
	readonly size: number;
}

export interface ICacheStats {
	readonly hits: number;
	readonly misses: number;
	readonly evictions: number;
	readonly size: number;
	readonly count: number;
	readonly hitRate: number;
}

export interface ICaches {
	readonly memory: ICacheStats;
	readonly disk: ICacheStats;
	readonly embedding: ICacheStats;
	readonly prompt: ICacheStats;
	readonly tool: ICacheStats;
	readonly http: ICacheStats;
	readonly provider: ICacheStats;
}

// ── Offline Types ───────────────────────────────────────────────────────────

export interface IOfflineStatus {
	readonly isOnline: boolean;
	readonly since: number;
	readonly lastOnline: number;
	readonly queuedOperations: number;
	readonly pendingSync: number;
}

export interface IQueuedOperation {
	readonly id: string;
	readonly type: 'create' | 'update' | 'delete';
	readonly entity: string;
	readonly entityId: string;
	readonly data: unknown;
	readonly timestamp: number;
	readonly retries: number;
	readonly priority: number;
}

export interface ISyncOperation {
	readonly id: string;
	readonly type: 'pull' | 'push';
	readonly status: 'pending' | 'syncing' | 'completed' | 'failed' | 'conflict';
	readonly entity: string;
	readonly entityId: string;
	readonly timestamp: number;
	readonly error?: string;
}

export interface IConflictResolution {
	readonly entity: string;
	readonly entityId: string;
	readonly localVersion: number;
	readonly remoteVersion: number;
	readonly resolution: 'local' | 'remote' | 'merge' | 'manual';
	readonly mergedData?: unknown;
	readonly resolvedAt: number;
}

// ── Backup Types ────────────────────────────────────────────────────────────

export interface IBackupConfig {
	readonly enabled: boolean;
	readonly interval: number; // milliseconds
	readonly retention: number; // number of backups to keep
	readonly include: {
		workspace: boolean;
		memory: boolean;
		workflow: boolean;
		configuration: boolean;
	};
	readonly storage: 'local' | 'remote';
	readonly path?: string;
}

export interface IBackup {
	readonly id: string;
	readonly name: string;
	readonly timestamp: number;
	readonly type: 'full' | 'incremental';
	readonly size: number;
	readonly checksum: string;
	readonly included: string[];
	readonly version: string;
}

export interface IRestorePoint {
	readonly backupId: string;
	readonly timestamp: number;
	readonly included: string[];
	readonly size: number;
}

// ── Recovery Types ──────────────────────────────────────────────────────────

export interface IRecoveryConfig {
	readonly enabled: boolean;
	readonly autoSave: boolean;
	readonly autoSaveInterval: number;
	readonly maxRecoveredSessions: number;
	readonly cleanupAfter: number; // days
}

export interface IRecoveryPoint {
	readonly id: string;
	readonly type: 'session' | 'workflow' | 'task' | 'agent';
	readonly entityId: string;
	readonly timestamp: number;
	readonly data: unknown;
	readonly checksum: string;
}

export interface ICrashRecovery {
	readonly timestamp: number;
	readonly recoveredSessions: number;
	readonly recoveredWorkflows: number;
	readonly recoveredTasks: number;
	readonly recoveredAgents: number;
	readonly failedRecoveries: number;
}

// ── Update Types ────────────────────────────────────────────────────────────

export type UpdateChannel = 'stable' | 'preview' | 'nightly';

export interface IUpdateConfig {
	readonly channel: UpdateChannel;
	readonly autoCheck: boolean;
	readonly autoDownload: boolean;
	readonly autoInstall: boolean;
	readonly lastCheck: number;
	readonly lastCheckVersion: string;
}

export interface IUpdateInfo {
	readonly version: string;
	readonly channel: UpdateChannel;
	readonly releaseDate: number;
	readonly size: number;
	readonly checksum: string;
	readonly notes: string;
	readonly breaking: boolean;
	readonly mandatory: boolean;
	readonly downloadUrl: string;
}

export interface IUpdateProgress {
	readonly state: 'idle' | 'checking' | 'downloading' | 'installing' | 'restarting';
	readonly version: string;
	readonly progress: number;
	 readonly speed: number;
	readonly ETA: number;
}

// ── Configuration Types ─────────────────────────────────────────────────────

export interface IConfigurationProfile {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly settings: Record<string, unknown>;
	readonly extensions: string[];
	readonly createdAt: number;
	readonly updatedAt: number;
}

export interface IConfigurationMigration {
	readonly fromVersion: number;
	readonly toVersion: number;
	readonly handler: string;
	 readonly applied: boolean;
	readonly appliedAt?: number;
}

export interface IConfigurationExport {
	readonly version: string;
	readonly timestamp: number;
	readonly settings: Record<string, unknown>;
	readonly extensions: string[];
	readonly keybindings: string[];
	readonly snippets: Record<string, string>;
}

// ── Health Types ────────────────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface IHealthCheck {
	readonly id: string;
	readonly name: string;
	readonly type: 'readiness' | 'liveness' | 'provider' | 'runtime' | 'workspace' | 'dependency';
	readonly status: HealthStatus;
	readonly timestamp: number;
	readonly latency: number;
	readonly message: string;
	readonly details?: Record<string, unknown>;
}

export interface IHealthSummary {
	readonly overall: HealthStatus;
	 readonly checks: IHealthCheck[];
	 readonly uptime: number;
	 readonly lastCheck: number;
}

export interface IProviderHealth {
	 readonly name: string;
	 readonly status: HealthStatus;
	 readonly latency: number;
	 readonly lastCheck: number;
	 readonly errorCount: number;
	 readonly requestCount: number;
}

// ── Production State Slices ─────────────────────────────────────────────────

export interface IProductionState {
	readonly telemetry: ITelemetryConfig | undefined;
	readonly metricsHistory: IMetricsHistory | undefined;
	readonly cacheState: ICaches | undefined;
	readonly offlineStatus: IOfflineStatus | undefined;
	readonly backupStatus: {
		lastBackup: number;
		nextBackup: number;
		backupCount: number;
	} | undefined;
	readonly healthSummary: IHealthSummary | undefined;
	readonly updateInfo: IUpdateInfo | undefined;
	readonly updateProgress: IUpdateProgress | undefined;
}

// ── Event Payloads for RuntimeEventBus ─────────────────────────────────────

export interface IHealthChangedPayload {
	readonly checkId: string;
	readonly status: HealthStatus;
	readonly message: string;
}

export interface ITelemetrySentPayload {
	readonly eventName: string;
	readonly count: number;
	readonly sampleRate: number;
}

export interface IMetricsUpdatedPayload {
	readonly systemMetrics: ISystemMetrics;
	readonly performanceMetrics: IPerformanceMetrics;
}

export interface ITraceCreatedPayload {
	readonly traceId: string;
	readonly type: string;
	readonly spanCount: number;
	readonly duration: number;
}

export interface ICacheClearedPayload {
	readonly cacheType: string;
	readonly reason: 'manual' | 'eviction' | 'ttl' | 'memory';
	readonly freedSpace: number;
}

export interface IOfflineModeChangedPayload {
	readonly isOnline: boolean;
	readonly reason: string;
}

export interface IBackupCompletedPayload {
	readonly backupId: string;
	readonly type: 'full' | 'incremental';
	readonly size: number;
	readonly duration: number;
}

export interface IRestoreCompletedPayload {
	readonly backupId: string;
	readonly restoredItems: string[];
	readonly duration: number;
}

export interface ICrashRecoveredPayload {
	readonly recoveredAt: number;
	readonly recoveredSessions: number;
	readonly recoveredWorkflows: number;
}

export interface IUpdateAvailablePayload {
	readonly version: string;
	readonly channel: UpdateChannel;
	readonly mandatory: boolean;
}

export interface IUpdateInstalledPayload {
	readonly version: string;
	readonly requiresRestart: boolean;
}
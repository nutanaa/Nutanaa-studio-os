/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Studio UI Model Types for Nutanaa Studio OS
 *
 * Defines all interfaces for UI components: Chat, Agent Monitor,
 * Workflow Designer, Timeline, Logs, Dashboard, and Explorers.
 */

// ── Chat Types ───────────────────────────────────────────────────────────────────────

export interface IChatMessage {
	readonly id: string;
	readonly role: 'user' | 'assistant' | 'tool' | 'system';
	readonly content: string;
	readonly timestamp: number;
	readonly tokens: number;
	readonly toolCalls?: IToolCall[];
	readonly toolResults?: IToolResult[];
	readonly attachments?: IChatAttachment[];
	readonly metadata?: IChatMessageMetadata;
}

export interface IToolCall {
	readonly id: string;
	readonly toolId: string;
	readonly toolName: string;
	readonly arguments: Record<string, unknown>;
	readonly status: 'pending' | 'executing' | 'completed' | 'failed';
	readonly timestamp: number;
}

export interface IToolResult {
	readonly callId: string;
	readonly success: boolean;
	readonly content: string;
	readonly error?: string;
	readonly executionTimeMs: number;
}

export interface IChatAttachment {
	readonly id: string;
	readonly type: 'file' | 'image' | 'code';
	readonly name: string;
	readonly uri?: string;
	readonly content?: string;
	readonly mimeType?: string;
}

export interface IChatMessageMetadata {
	readonly model?: string;
	readonly provider?: string;
	readonly latencyMs?: number;
	readonly editHistory?: Array<{ content: string; timestamp: number }>;
}

export interface IChatSession {
	readonly id: string;
	readonly title: string;
	readonly messages: IChatMessage[];
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly model?: string;
	readonly provider?: string;
	readonly contextTokens: number;
	readonly completionTokens: number;
}

export interface IChatInputState {
	readonly text: string;
	readonly attachments: IChatAttachment[];
	readonly isGenerating: boolean;
	readonly suggestion?: string;
}

// ── Agent Monitor Types ───────────────────────────────────────────────────────────

export interface IAgentMonitorEntry {
	readonly id: string;
	readonly name: string;
	readonly status: 'running' | 'queued' | 'completed' | 'cancelled' | 'failed';
	readonly agentType: string;
	readonly startTime: number;
	readonly endTime?: number;
	readonly progress: number;
	readonly message: string;
	readonly cpuUsage?: number;
	readonly memoryUsage?: number;
	readonly currentProvider?: string;
	readonly latency?: number;
	readonly taskCount: number;
	readonly completedTasks: number;
	readonly error?: string;
}

export interface IAgentMonitorState {
	readonly running: IAgentMonitorEntry[];
	readonly queued: IAgentMonitorEntry[];
	readonly completed: IAgentMonitorEntry[];
	readonly cancelled: IAgentMonitorEntry[];
	readonly failed: IAgentMonitorEntry[];
	readonly totalCpuUsage: number;
	readonly totalMemoryUsage: number;
	readonly averageLatency: number;
}

// ── Workflow Designer Types ───────────────────────────────────────────────────────

export type WorkflowNodeType =
	| 'sequential'
	| 'parallel'
	| 'conditional'
	| 'loop'
	| 'retry'
	| 'subworkflow'
	| 'agent'
	| 'tool'
	| 'start'
	| 'end';

export interface IWorkflowNode {
	id: string;
	type: WorkflowNodeType;
	label: string;
	description?: string;
	position: IWorkflowPosition;
	config: IWorkflowNodeConfig;
	status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
	executionTime?: number;
	error?: string;
}

export interface IWorkflowPosition {
	x: number;
	y: number;
}

export interface IWorkflowNodeConfig {
	agentId?: string;
	toolId?: string;
	condition?: string;
	maxIterations?: number;
	retryCount?: number;
	retryDelay?: number;
	parallelNodes?: string[];
	subworkflowId?: string;
	inputMapping?: Record<string, string>;
	outputMapping?: Record<string, string>;
}

export interface IWorkflowEdge {
	id: string;
	sourceId: string;
	targetId: string;
	label?: string;
	condition?: string;
	status: 'pending' | 'active' | 'completed' | 'failed';
}

export interface IWorkflowGraph {
	id: string;
	name: string;
	description?: string;
	nodes: IWorkflowNode[];
	edges: IWorkflowEdge[];
	status: 'created' | 'running' | 'completed' | 'failed' | 'cancelled';
	createdAt: number;
	startedAt?: number;
	completedAt?: number;
	version: number;
}

export interface IWorkflowPaletteItem {
	type: WorkflowNodeType;
	label: string;
	icon: string;
	description: string;
}

// ── Timeline Types ─────────────────────────────────────────────────────────────────

export type TimelineEventType =
	| 'agent_started'
	| 'agent_completed'
	| 'agent_failed'
	| 'task_started'
	| 'task_completed'
	| 'task_failed'
	| 'workflow_started'
	| 'workflow_completed'
	| 'workflow_failed'
	| 'provider_connected'
	| 'provider_disconnected'
	| 'provider_failed'
	| 'prompt_rendered'
	| 'memory_updated'
	| 'embedding_created'
	| 'tool_started'
	| 'tool_completed'
	| 'tool_failed'
	| 'connection_status'
	| 'error'
	| 'warning'
	| 'info';

export interface ITimelineEvent {
	readonly id: string;
	readonly type: TimelineEventType;
	readonly timestamp: number;
	readonly title: string;
	readonly description: string;
	readonly source: string;
	readonly severity: 'info' | 'warning' | 'error';
	readonly metadata?: Record<string, unknown>;
	readonly relatedEntityId?: string;
	readonly relatedEntityType?: string;
}

export interface ITimelineFilter {
	readonly eventTypes?: TimelineEventType[];
	readonly severities?: ('info' | 'warning' | 'error')[];
	readonly sources?: string[];
	readonly searchQuery?: string;
	readonly startTime?: number;
	readonly endTime?: number;
}

// ── Logs Explorer Types ───────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

export interface ILogEntry {
	readonly id: string;
	readonly timestamp: number;
	readonly level: LogLevel;
	readonly message: string;
	readonly source: string;
	readonly category?: string;
	readonly correlationId?: string;
	readonly metadata?: Record<string, unknown>;
}

export interface ILogsFilter {
	readonly levels?: LogLevel[];
	readonly sources?: string[];
	readonly categories?: string[];
	readonly searchQuery?: string;
	readonly startTime?: number;
	readonly endTime?: number;
}

export interface ILogsGrouping {
	readonly enabled: boolean;
	readonly by: 'source' | 'category' | 'level';
}

// ── Dashboard Types ─────────────────────────────────────────────────────────────────

export interface IDashboardMetrics {
	readonly connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
	readonly activeProviders: number;
	readonly healthyProviders: number;
	readonly selectedProvider?: string;
	readonly selectedModel?: string;
	readonly totalModels: number;
	readonly totalPrompts: number;
	readonly totalTools: number;
	readonly runningAgents: number;
	readonly queuedTasks: number;
	readonly memoryUsage: {
		readonly totalEntries: number;
		readonly totalTokens: number;
		readonly byType: Record<string, number>;
	};
	readonly embeddingStats: {
		readonly totalEmbeddings: number;
		readonly totalChunks: number;
		readonly averageDimensions: number;
	};
	readonly tokenUsage: {
		readonly today: number;
		readonly thisWeek: number;
		readonly thisMonth: number;
	};
	readonly executionMetrics: {
		readonly totalExecuted: number;
		readonly successRate: number;
		readonly averageExecutionTime: number;
	};
}

// ── Provider Explorer Types ───────────────────────────────────────────────────────

export interface IProviderExplorerEntry {
	readonly name: string;
	readonly type: string;
	readonly baseUrl: string;
	readonly model: string;
	readonly isHealthy: boolean;
	readonly latencyMs: number;
	readonly capabilities: {
		readonly streaming: boolean;
		readonly functionCalling: boolean;
		readonly vision: boolean;
		readonly audio: boolean;
		readonly embedding: boolean;
		readonly reasoning: boolean;
	};
	readonly models: IProviderModelInfo[];
	readonly isSelected: boolean;
	readonly isEnabled: boolean;
}

export interface IProviderModelInfo {
	readonly id: string;
	readonly name: string;
	readonly contextLength: number;
	readonly maxOutputTokens: number;
	readonly available: boolean;
}

// ── Memory Explorer Types ─────────────────────────────────────────────────────────

export interface IMemoryExplorerEntry {
	readonly id: string;
	readonly type: 'conversation' | 'agent' | 'workspace' | 'project' | 'knowledge';
	readonly key: string;
	readonly content: string;
	readonly preview: string;
	readonly tags: string[];
	readonly timestamp: number;
	readonly lastAccessed: number;
	readonly accessCount: number;
	readonly score: number;
}

export interface IMemoryExplorerFilter {
	readonly types?: string[];
	readonly tags?: string[];
	readonly searchQuery?: string;
}

// ── Tool Explorer Types ───────────────────────────────────────────────────────────

export interface IToolExplorerEntry {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly type: string;
	readonly category: string;
	readonly permissions: string[];
	readonly isEnabled: boolean;
	readonly requiresConfirmation: boolean;
	readonly executionCount: number;
	readonly successRate: number;
	readonly averageExecutionTime: number;
}

export interface IToolExplorerFilter {
	readonly types?: string[];
	readonly categories?: string[];
	readonly searchQuery?: string;
	readonly enabledOnly?: boolean;
}

// ── Notifications Center Types ────────────────────────────────────────────────────

export type NotificationType = 'error' | 'warning' | 'success' | 'info';

export interface INotification {
	readonly id: string;
	readonly type: NotificationType;
	readonly title: string;
	readonly message: string;
	readonly timestamp: number;
	readonly source: string;
	readonly dismissible: boolean;
	readonly dismissibleOnce: boolean;
	readonly actions?: INotificationAction[];
	readonly metadata?: Record<string, unknown>;
}

export interface INotificationAction {
	readonly id: string;
	readonly label: string;
	readonly primary: boolean;
}

export interface INotificationSettings {
	readonly showErrors: boolean;
	readonly showWarnings: boolean;
	readonly showSuccess: boolean;
	readonly showInfo: boolean;
	readonly maxVisible: number;
	readonly autoDismissDelay: number;
}

// ── View State Types ───────────────────────────────────────────────────────────────

export interface IStudioViewState {
	readonly activeView: StudioView;
	readonly chat: {
		readonly sessionId?: string;
		readonly expanded: boolean;
	};
	readonly agentMonitor: {
		readonly filter: 'all' | 'running' | 'queued' | 'completed' | 'failed';
	};
	readonly workflowDesigner: {
		readonly workflowId?: string;
		readonly zoom: number;
		readonly showPalette: boolean;
	};
	readonly timeline: {
		readonly filter: ITimelineFilter;
	};
	readonly logs: {
		readonly filter: ILogsFilter;
		readonly grouping: ILogsGrouping;
		readonly autoScroll: boolean;
	};
	readonly dashboard: {
		readonly refreshInterval: number;
	};
	readonly providerExplorer: {
		readonly showDisabled: boolean;
	};
	readonly memoryExplorer: {
		readonly filter: IMemoryExplorerFilter;
	};
	readonly toolExplorer: {
		readonly filter: IToolExplorerFilter;
	};
	readonly notifications: {
		readonly settings: INotificationSettings;
	};
}

export type StudioView =
	| 'dashboard'
	| 'chat'
	| 'agents'
	| 'workflows'
	| 'timeline'
	| 'logs'
	| 'providers'
	| 'memory'
	| 'tools'
	| 'notifications';

// ── Event Payloads for UI ─────────────────────────────────────────────────────────

export interface IChatMessagePayload {
	readonly sessionId: string;
	readonly message: IChatMessage;
}

export interface IAgentStatePayload {
	readonly agentId: string;
	readonly entry: IAgentMonitorEntry;
}

export interface IWorkflowPayload {
	readonly workflowId: string;
	readonly graph: IWorkflowGraph;
}

export interface INotificationPayload {
	readonly notification: INotification;
}
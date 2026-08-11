/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * AI Core Type Definitions for Nutanaa Studio OS
 *
 * Defines all interfaces for ProviderManager, ModelRegistry, PromptManager,
 * ContextBuilder, MemoryManager, EmbeddingManager, and ToolManager.
 */

// ── Provider Types ───────────────────────────────────────────────────────────────────────

export type ProviderType =
	| 'ollama'
	| 'openai'
	| 'anthropic'
	| 'gemini'
	| 'azure-openai'
	| 'openrouter'
	| 'custom-rest';

export interface IProviderCapabilities {
	readonly supportsStreaming: boolean;
	readonly supportsFunctionCalling: boolean;
	readonly supportsVision: boolean;
	readonly supportsAudio: boolean;
	readonly supportsEmbedding: boolean;
	readonly supportsReasoning: boolean;
	readonly maxContextLength: number;
	readonly maxOutputTokens: number;
	readonly defaultTemperature: number;
	readonly supportedModalities: ('text' | 'image' | 'audio' | 'video')[];
}

export interface IProviderConfig {
	readonly type: ProviderType;
	readonly name: string;
	readonly baseUrl: string;
	readonly apiKey?: string;
	readonly organizationId?: string;
	readonly deploymentName?: string;
	readonly apiVersion?: string;
	readonly model: string;
	readonly capabilities: IProviderCapabilities;
	readonly timeoutMs: number;
	readonly maxRetries: number;
	readonly enabled: boolean;
	readonly priority: number;
}

export interface IProviderHealth {
	readonly providerName: string;
	readonly isHealthy: boolean;
	readonly lastChecked: number;
	readonly latencyMs: number;
	readonly errorCount: number;
	readonly modelAvailable: boolean;
}

export interface IProviderStatus {
	readonly config: IProviderConfig;
	readonly health: IProviderHealth;
	readonly isSelected: boolean;
	readonly currentLoad: number;
}

export interface IProviderRequest {
	readonly providerType?: ProviderType;
	readonly capabilities?: Partial<IProviderCapabilities>;
	readonly maxLatencyMs?: number;
	readonly priority?: number;
}

export interface IProviderSelectionResult {
	readonly provider: IProviderConfig;
	 readonly loadBalancingDecision: string;
}

// ── Model Types ─────────────────────────────────────────────────────────────────────────

export interface IModelInfo {
	readonly id: string;
	readonly name: string;
	readonly provider: ProviderType;
	readonly providerName: string;
	readonly contextLength: number;
	readonly maxOutputTokens: number;
	readonly capabilities: IProviderCapabilities;
	readonly pricing: {
		readonly inputPer1M: number;
		readonly outputPer1M: number;
	};
	readonly defaultTemperature: number;
	readonly available: boolean;
}

export interface IModelFilter {
	readonly providerType?: ProviderType;
	 readonly minContextLength?: number;
	readonly supportsStreaming?: boolean;
	readonly supportsFunctionCalling?: boolean;
	readonly supportsVision?: boolean;
	readonly maxPricePer1M?: number;
}

// ── Prompt Types ───────────────────────────────────────────────────────────────────────

export interface IPromptVariable {
	readonly name: string;
	readonly description: string;
	readonly required: boolean;
	readonly defaultValue?: string;
	readonly validationPattern?: string;
}

export interface IPromptTemplate {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly version: number;
	readonly tags: string[];
	readonly systemPrompt: string;
	readonly developerPrompt?: string;
	 readonly userPromptTemplate: string;
	 readonly variables: IPromptVariable[];
	 readonly metadata?: Record<string, unknown>;
	 readonly createdAt: number;
	 readonly updatedAt: number;
}

export interface IPromptRenderOptions {
	 readonly variables: Record<string, string>;
	 readonly includeSystemPrompt: boolean;
	 readonly includeDeveloperPrompt: boolean;
	 readonly maxTokens?: number;
	 readonly temperature?: number;
}

export interface IPromptRenderResult {
	 readonly systemPrompt: string;
	 readonly developerPrompt?: string;
	 readonly userPrompt: string;
	 readonly renderedAt: number;
	 readonly tokenCount: number;
	 readonly warnings: string[];
}

export interface IPromptValidationResult {
	 readonly valid: boolean;
	 readonly errors: string[];
	 readonly warnings: string[];
}

// ── Context Types ───────────────────────────────────────────────────────────────────────

export interface IContextEntry {
	readonly id: string;
	readonly type: 'conversation' | 'memory' | 'knowledge' | 'workspace' | 'selection' | 'editor' | 'execution' | 'tool';
	readonly content: string;
	readonly importance: number;
	readonly source: string;
	readonly timestamp: number;
	tokenCount: number;
	readonly metadata?: Record<string, unknown>;
}

export interface IContextBuilderOptions {
	 readonly maxTokens: number;
	 readonly includeConversationHistory: boolean;
	 readonly includeMemory: boolean;
	 readonly includeKnowledge: boolean;
	 readonly includeWorkspaceContext: boolean;
	 readonly includeEditorContext: boolean;
	 readonly includeExecutionContext: boolean;
	 readonly includeToolContext: boolean;
	 readonly systemPrompt?: string;
	 readonly userQuery?: string;
	 readonly currentFile?: string;
	 readonly selectedText?: string;
}

export interface IContextBuildResult {
	 readonly context: IContextEntry[];
	 readonly totalTokens: number;
	 readonly truncated: boolean;
	 readonly includedSources: string[];
}

// ── Tool Types ─────────────────────────────────────────────────────────────────────────

export type ToolType =
	| 'editor'
	| 'terminal'
	| 'file'
	| 'workspace'
	| 'search'
	| 'git'
	| 'http'
	| 'database'
	| 'memory';

export type ToolPermission = 'read' | 'write' | 'execute' | 'admin';

export interface IToolParameter {
	readonly name: string;
	 readonly type: 'string' | 'number' | 'boolean' | 'object' | 'array';
	 readonly description: string;
	 readonly required: boolean;
	 readonly defaultValue?: unknown;
	 readonly enumValues?: string[];
}

export interface IToolDefinition {
	 readonly id: string;
	 readonly name: string;
	 readonly description: string;
	 readonly type: ToolType;
	 readonly category: string;
	 readonly parameters: IToolParameter[];
	 readonly returns: {
		readonly type: string;
		readonly description: string;
	};
	 readonly permissions: ToolPermission[];
	 readonly timeoutMs: number;
	 readonly requiresConfirmation: boolean;
	 readonly enabled: boolean;
	 readonly version: number;
}

export interface IToolExecutionContext {
	readonly toolId: string;
	 readonly agentId?: string;
	 readonly correlationId?: string;
	 readonly parentContextId?: string;
}

export interface IToolResult {
	readonly executionId: string;
	 readonly toolId: string;
	 readonly success: boolean;
	 readonly content: string;
	 readonly error?: string;
	 readonly executionTimeMs: number;
	 readonly tokenUsage?: number;
	 readonly streaming: boolean;
	 readonly partialResults?: string[];
}

// ── Embedding Types ───────────────────────────────────────────────────────────────────

export interface IEmbeddingResult {
	 readonly id: string;
	 readonly vector: number[];
	 readonly dimensions: number;
	 readonly modelName: string;
	 readonly text: string;
	 readonly chunkId: string;
	 readonly timestamp: number;
}

export interface IBatchEmbeddingRequest {
	readonly texts: string[];
	readonly chunkIds: string[];
	readonly priority: number;
	readonly batchSize?: number;
}

export interface ISimilaritySearchResult {
	readonly chunkId: string;
	 readonly content: string;
	 readonly score: number;
	 readonly uri?: string;
	 readonly startLine?: number;
	 readonly endLine?: number;
}

export interface IEmbeddingOptions {
	 readonly model: string;
	 readonly dimensions?: number;
	 readonly batchSize?: number;
}

// ── Memory Types ───────────────────────────────────────────────────────────────────────

export type MemoryStorageType = 'conversation' | 'agent' | 'workspace' | 'project' | 'knowledge' | 'session';

export interface IMemoryEntry {
	readonly id: string;
	readonly type: MemoryStorageType;
	readonly key: string;
	readonly content: string;
	readonly embedding?: number[];
	 readonly tags: string[];
	readonly timestamp: number;
	 readonly lastAccessedTimestamp: number;
	 readonly accessCount: number;
	 readonly score: number;
	 readonly metadata?: Record<string, unknown>;
}

export interface IMemorySearchOptions {
	 readonly types?: MemoryStorageType[];
	 readonly tags?: string[];
	readonly limit?: number;
	 readonly minScore?: number;
	 readonly maxAgeMs?: number;
	readonly includeEmbeddings: boolean;
}

export interface IMemorySearchResult {
	 readonly entry: IMemoryEntry;
	 readonly relevanceScore: number;
}

export interface IMemoryStats {
	 readonly totalEntries: number;
	 readonly byType: Record<MemoryStorageType, number>;
	 readonly totalTokens: number;
	 readonly oldestEntry: number;
	 readonly newestEntry: number;
}

export interface IEmbeddingStats {
	readonly totalEmbeddings: number;
	readonly totalChunks: number;
	readonly averageDimensions: number;
}

export interface IMemoryState {
	 readonly memories: Map<string, IMemoryEntry>;
	 readonly stats: IMemoryStats;
	 readonly embeddingStats: IEmbeddingStats;
	 readonly recent?: IMemoryEntry[];
}

export interface IProviderState {
	 readonly config: IProviderConfig;
	 readonly health: IProviderHealth;
	 readonly summary: string;
	 readonly lastCheckedAt: number;
	 readonly memoryUpdates?: {
		added?: IMemoryEntry[];
		updated?: IMemoryEntry[];
		deleted?: string[];
		cleared?: MemoryStorageType;
		stats?: IMemoryStats;
	 };
}

// ── Event Payloads for RuntimeEventBus ─────────────────────────────────────────────────

export interface IProviderChangedPayload {
	readonly providerName: string;
	readonly previousStatus: string;
	readonly newStatus: string;
	 readonly model?: string;
}

export interface IProviderConnectedPayload {
	 readonly providerName: string;
	 readonly providerType: ProviderType;
	 readonly latencyMs: number;
}

export interface IProviderDisconnectedPayload {
	 readonly providerName: string;
	 readonly reason: string;
	 readonly willRetry: boolean;
}

export interface IProviderFailedPayload {
	 readonly providerName: string;
	 readonly error: string;
	 readonly retryCount: number;
	 readonly willRetry: boolean;
}

export interface IPromptRenderedPayload {
	 readonly promptId: string;
	 readonly promptName: string;
	 readonly tokenCount: number;
	 readonly variables: Record<string, string>;
}

export interface IMemoryUpdatedPayload {
	readonly memoryId: string;
	 readonly memoryType: MemoryStorageType;
	 readonly operation: 'create' | 'update' | 'delete' | 'clear';
	readonly entryCount: number;
}

export interface IEmbeddingCreatedPayload {
	 readonly embeddingId: string;
	 readonly chunkId: string;
	 readonly dimensions: number;
	 readonly modelName: string;
}

export interface IToolStartedPayload {
	 readonly toolId: string;
	 readonly toolName: string;
	 readonly agentId?: string;
	 readonly executionId: string;
	 readonly parameters: Record<string, unknown>;
}

export interface IToolCompletedPayload {
	 readonly toolId: string;
	 readonly toolName: string;
	 readonly agentId?: string;
	 readonly executionId: string;
	 readonly success: boolean;
	 readonly executionTimeMs: number;
	 readonly resultSize: number;
}

export interface IToolFailedPayload {
	 readonly toolId: string;
	 readonly toolName: string;
	 readonly agentId?: string;
	 readonly executionId: string;
	 readonly error: string;
	 readonly canRetry: boolean;
}
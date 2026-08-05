/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableMap } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import {
	ToolType,
	ToolPermission,
	IToolDefinition,
	IToolParameter,
	IToolResult,
	IToolExecutionContext,
} from '../models/aiCore.js';
import { IToolManager } from '../common/toolManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../common/runtimeEventBus.js';
import { IRuntimeStateService } from '../common/runtimeState.js';

interface ExecutionRecord {
	readonly executionId: string;
	readonly toolId: string;
	readonly params: Record<string, unknown>;
	readonly context?: IToolExecutionContext;
	readonly startTime: number;
	 cancelled: boolean;
}

interface ToolExecutor {
	execute(params: Record<string, unknown>): Promise<string>;
	stream?(params: Record<string, unknown>): AsyncIterable<string>;
	cancel(): void;
}

/**
 * ToolManager implementation for Nutanaa Studio OS.
 *
 * Manages tools with registration, permissions, validation,
 * and execution capabilities.
 */
export class ToolManager extends Disposable implements IToolManager {

	declare readonly _serviceBrand: undefined;

	private readonly tools = new Map<string, IToolDefinition>();
	private readonly executions = new Map<string, ExecutionRecord>();
	private readonly executors = new Map<string, ToolExecutor>();
	private readonly activeExecutions = new Map<string, AbortController>();

	private readonly _onDidStartExecution = this._register(new Emitter<IToolResult>());
	private readonly _onDidCompleteExecution = this._register(new Emitter<IToolResult>());
	private readonly _onDidFailExecution = this._register(new Emitter<IToolResult>());
	private readonly _onDidChangeTools = this._register(new Emitter<void>());

	public readonly onDidStartExecution = Event.fromEmitter(this._onDidStartExecution);
	public readonly onDidCompleteExecution = Event.fromEmitter(this._onDidCompleteExecution);
	public readonly onDidFailExecution = Event.fromEmitter(this._onDidFailExecution);
	public readonly onDidChangeTools = Event.fromEmitter(this._onDidChangeTools);

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.registerBuiltInTools();
	}

	// ── Tool Registration ───────────────────────────────────────────────────────

	registerTool(tool: IToolDefinition): boolean {
		if (this.tools.has(tool.id)) {
			this.logService.warn(`Tool ${tool.id} already registered`);
			return false;
		}

		const validation = this.validateTool(tool);
		if (!validation.valid) {
			this.logService.error(`Tool ${tool.id} validation failed: ${validation.errors.join(', ')}`);
			return false;
		}

		this.tools.set(tool.id, tool);

		// Create executor for this tool
		this.createExecutor(tool);

		// Update runtime state
		this.runtimeStateService.updateProviders({
			addedTools: [tool],
		});

		// Fire event
		this._onDidChangeTools.fire();

		this.logService.info(`Tool ${tool.name} (${tool.id}) registered`);
		return true;
	}

	unregisterTool(toolId: string): boolean {
		const tool = this.tools.get(toolId);
		if (!tool) {
			this.logService.warn(`Tool ${toolId} not found for unregistration`);
			return false;
		}

		this.tools.delete(toolId);
		this.executors.delete(toolId);

		// Update runtime state
		this.runtimeStateService.updateProviders({
			removedTools: [toolId],
		});

		// Fire event
		this._onDidChangeTools.fire();

		this.logService.info(`Tool ${toolId} unregistered`);
		return true;
	}

	updateTool(toolId: string, updates: Partial<IToolDefinition>): boolean {
		const tool = this.tools.get(toolId);
		if (!tool) {
			this.logService.warn(`Tool ${toolId} not found for update`);
			return false;
		}

		const newTool = { ...tool, ...updates };
		this.tools.set(toolId, newTool);

		// Recreate executor if needed
		if (updates.type || updates.category) {
			this.createExecutor(newTool);
		}

		// Update runtime state
		this.runtimeStateService.updateProviders({
			updatedTools: [newTool],
		});

		// Fire event
		this._onDidChangeTools.fire();

		this.logService.info(`Tool ${toolId} updated`);
		return true;
	}

	// ── Tool Discovery ─────────────────────────────────────────────────────────

	getAllTools(): IToolDefinition[] {
		return Array.from(this.tools.values());
	}

	getTool(toolId: string): IToolDefinition | undefined {
		return this.tools.get(toolId);
	}

	getToolByName(name: string): IToolDefinition | undefined {
		for (const tool of this.tools.values()) {
			if (tool.name === name) {
				return tool;
			}
		}
		return undefined;
	}

	getToolsByType(type: ToolType): IToolDefinition[] {
		const results: IToolDefinition[] = [];
		for (const tool of this.tools.values()) {
			if (tool.type === type) {
				results.push(tool);
			}
		}
		return results;
	}

	getToolsByCategory(category: string): IToolDefinition[] {
		const results: IToolDefinition[] = [];
		for (const tool of this.tools.values()) {
			if (tool.category === category) {
				results.push(tool);
			}
		}
		return results;
	}

	searchTools(query: string): IToolDefinition[] {
		const queryLower = query.toLowerCase();
		const results: IToolDefinition[] = [];

		for (const tool of this.tools.values()) {
			if (tool.name.toLowerCase().includes(queryLower) ||
				tool.description.toLowerCase().includes(queryLower) ||
				tool.category.toLowerCase().includes(queryLower)) {
				results.push(tool);
			}
		}

		return results;
	}

	// ── Permission Management ───────────────────────────────────────────────────

	canExecute(toolId: string, userPermissions: ToolPermission[]): boolean {
		const tool = this.tools.get(toolId);
		if (!tool) {
			return false;
		}

		if (!tool.enabled) {
			return false;
		}

		const requiredPermissions = tool.permissions;
		return requiredPermissions.every(p => userPermissions.includes(p));
	}

	getRequiredPermissions(toolId: string): ToolPermission[] {
		return this.tools.get(toolId)?.permissions ?? [];
	}

	setToolPermissions(toolId: string, permissions: ToolPermission[]): boolean {
		const tool = this.tools.get(toolId);
		if (!tool) {
			return false;
		}

		const newTool = { ...tool, permissions };
		this.tools.set(toolId, newTool);

		this.runtimeStateService.updateProviders({
			updatedTools: [newTool],
		});

		return true;
	}

	setToolEnabled(toolId: string, enabled: boolean): boolean {
		const tool = this.tools.get(toolId);
		if (!tool) {
			return false;
		}

		const newTool = { ...tool, enabled };
		this.tools.set(toolId, newTool);

		this.runtimeStateService.updateProviders({
			updatedTools: [newTool],
		});

		return true;
	}

	// ── Validation ─────────────────────────────────────────────────────────────

	validateParameters(toolId: string, params: Record<string, unknown>): { valid: boolean; errors: string[] } {
		const tool = this.tools.get(toolId);
		if (!tool) {
			return { valid: false, errors: ['Tool not found'] };
		}

		const errors: string[] = [];

		// Check required parameters
		for (const param of tool.parameters) {
			if (param.required && !(param.name in params)) {
				errors.push(`Required parameter '${param.name}' is missing`);
				continue;
			}

			if (param.name in params) {
				const value = params[param.name];
				const typeErrors = this.validateParameterType(param, value);
				errors.push(...typeErrors);

				// Check enum values
				if (param.enumValues && param.enumValues.length > 0) {
					if (!param.enumValues.includes(String(value))) {
						errors.push(`Parameter '${param.name}' must be one of: ${param.enumValues.join(', ')}`);
					}
				}
			}
		}

		// Check for extra parameters (warnings, not errors)
		const validNames = new Set(tool.parameters.map(p => p.name));
		for (const name of Object.keys(params)) {
			if (!validNames.has(name)) {
				errors.push(`Unknown parameter '${name}'`);
			}
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	validateTool(tool: IToolDefinition): { valid: boolean; errors: string[]; warnings: string[] } {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Check required fields
		if (!tool.id) {
			errors.push('Tool ID is required');
		}
		if (!tool.name) {
			errors.push('Tool name is required');
		}
		if (!tool.description) {
			errors.push('Tool description is required');
		}
		if (!tool.type) {
			errors.push('Tool type is required');
		}
		if (!tool.category) {
			warnings.push('Tool category is recommended');
		}

		// Check parameters
		const paramNames = new Set<string>();
		for (const param of tool.parameters) {
			if (paramNames.has(param.name)) {
				errors.push(`Duplicate parameter name: '${param.name}'`);
			}
			paramNames.add(param.name);

			if (!param.name) {
				errors.push('Parameter name is required');
			}
			if (!param.description) {
				warnings.push(`Parameter '${param.name || 'unknown'}' should have a description`);
			}
		}

		// Check timeout
		if (tool.timeoutMs <= 0) {
			errors.push('Timeout must be positive');
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	// ── Execution ───────────────────────────────────────────────────────────────

	async execute(
		toolId: string,
		params: Record<string, unknown>,
		context?: IToolExecutionContext
	): Promise<IToolResult> {
		const tool = this.tools.get(toolId);
		if (!tool) {
			const result = this.createErrorResult(toolId, context?.correlationId, 'Tool not found');
			this._onDidFailExecution.fire(result);
			return result;
		}

		// Validate parameters
		const validation = this.validateParameters(toolId, params);
		if (!validation.valid) {
			const result = this.createErrorResult(
				toolId,
				context?.correlationId,
				validation.errors.join('; ')
			);
			this._onDidFailExecution.fire(result);
			return result;
		}

		const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const startTime = Date.now();

		const record: ExecutionRecord = {
			executionId,
			toolId,
			params,
			context,
			startTime,
			cancelled: false,
		};

		this.executions.set(executionId, record);

		// Fire start event
		this.runtimeEventBus.fire({
			type: RuntimeEventType.ToolStarted,
			timestamp: startTime,
			payload: {
				toolId,
				toolName: tool.name,
				agentId: context?.agentId,
				executionId,
				parameters: params,
			},
		});

		const abortController = new AbortController();
		this.activeExecutions.set(executionId, abortController);

		try {
			// Execute with timeout
			const executor = this.executors.get(toolId);
			let content: string;

			if (executor) {
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(() => reject(new Error('Tool execution timeout')), tool.timeoutMs);
				});

				const executionPromise = executor.execute(params);

				content = await Promise.race([executionPromise, timeoutPromise]);
			} else {
				content = `Tool ${tool.name} executed with params: ${JSON.stringify(params)}`;
			}

			const executionTime = Date.now() - startTime;

			const result: IToolResult = {
				executionId,
				toolId,
				success: true,
				content,
				executionTimeMs: executionTime,
				streaming: false,
			};

			this.executions.set(executionId, { ...record, cancelled: false });
			this.activeExecutions.delete(executionId);

			// Fire completion event
			this._onDidCompleteExecution.fire(result);
			this.runtimeEventBus.fire({
				type: RuntimeEventType.ToolCompleted,
				timestamp: Date.now(),
				payload: {
					toolId,
					toolName: tool.name,
					agentId: context?.agentId,
					executionId,
					success: true,
					executionTimeMs: executionTime,
					resultSize: content.length,
				},
			});

			this.logService.debug(`Tool ${toolId} executed in ${executionTime}ms`);
			return result;

		} catch (err) {
			const executionTime = Date.now() - startTime;
			const errorMessage = err instanceof Error ? err.message : String(err);

			const result: IToolResult = {
				executionId,
				toolId,
				success: false,
				content: '',
				error: errorMessage,
				executionTimeMs: executionTime,
				streaming: false,
			};

			this.executions.set(executionId, { ...record, cancelled: false });
			this.activeExecutions.delete(executionId);

			// Fire failure event
			this._onDidFailExecution.fire(result);
			this.runtimeEventBus.fire({
				type: RuntimeEventType.ToolFailed,
				timestamp: Date.now(),
				payload: {
					toolId,
					toolName: tool.name,
					agentId: context?.agentId,
					executionId,
					error: errorMessage,
					canRetry: true,
				},
			});

			this.logService.error(`Tool ${toolId} failed: ${errorMessage}`);
			return result;
		}
	}

	async *stream(
		toolId: string,
		params: Record<string, unknown>,
		context?: IToolExecutionContext
	): AsyncIterable<string> {
		const tool = this.tools.get(toolId);
		if (!tool) {
			throw new Error('Tool not found');
		}

		const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const startTime = Date.now();

		const record: ExecutionRecord = {
			executionId,
			toolId,
			params,
			context,
			startTime,
			cancelled: false,
		};

		this.executions.set(executionId, record);

		const abortController = new AbortController();
		this.activeExecutions.set(executionId, abortController);

		try {
			const executor = this.executors.get(toolId);

			if (executor?.stream) {
				for await (const chunk of executor.stream(params)) {
					if (this.activeExecutions.get(executionId)?.signal.aborted) {
						break;
					}
					yield chunk;
				}
			} else {
				// Fall back to non-streaming
				const result = await this.execute(toolId, params, context);
				if (result.success) {
					yield result.content;
				} else {
					throw new Error(result.error);
				}
			}
		} finally {
			this.activeExecutions.delete(executionId);
		}
	}

	cancel(executionId: string): boolean {
		const record = this.executions.get(executionId);
		if (!record) {
			return false;
		}

		const abortController = this.activeExecutions.get(executionId);
		if (abortController) {
			abortController.abort();
			this.activeExecutions.delete(executionId);
		}

		this.executions.set(executionId, { ...record, cancelled: true });

		this.logService.info(`Execution ${executionId} cancelled`);
		return true;
	}

	getExecutionStatus(executionId: string): IToolResult | undefined {
		const record = this.executions.get(executionId);
		if (!record) {
			return undefined;
		}

		return {
			executionId: record.executionId,
			toolId: record.toolId,
			success: !record.cancelled,
			content: '',
			executionTimeMs: Date.now() - record.startTime,
			streaming: false,
		};
	}

	// ── Events ─────────────────────────────────────────────────────────────────

	onDidStartExecution(listener: (result: IToolResult) => void) {
		return this._onDidStartExecution.event(listener);
	}

	onDidCompleteExecution(listener: (result: IToolResult) => void) {
		return this._onDidCompleteExecution.event(listener);
	}

	onDidFailExecution(listener: (result: IToolResult) => void) {
		return this._onDidFailExecution.event(listener);
	}

	onDidChangeTools(listener: () => void) {
		return this._onDidChangeTools.event(listener);
	}

	// ── Built-in Tools ─────────────────────────────────────────────────────────

	private registerBuiltInTools(): void {
		// Editor Tool
		this.registerTool({
			id: 'editor.read',
			name: 'Read File',
			description: 'Read the contents of a file',
			type: 'editor',
			category: 'File Operations',
			parameters: [
				{ name: 'path', type: 'string', description: 'File path to read', required: true },
				{ name: 'encoding', type: 'string', description: 'File encoding', required: false, defaultValue: 'utf-8' },
			],
			returns: { type: 'string', description: 'File contents' },
			permissions: ['read'],
			timeoutMs: 30000,
			requiresConfirmation: false,
			enabled: true,
			version: 1,
		});

		// File Tool
		this.registerTool({
			id: 'file.write',
			name: 'Write File',
			description: 'Write content to a file',
			type: 'file',
			category: 'File Operations',
			parameters: [
				{ name: 'path', type: 'string', description: 'File path to write', required: true },
				{ name: 'content', type: 'string', description: 'Content to write', required: true },
				{ name: 'encoding', type: 'string', description: 'File encoding', required: false, defaultValue: 'utf-8' },
			],
			returns: { type: 'object', description: 'Write result with path and bytes written' },
			permissions: ['write'],
			timeoutMs: 30000,
			requiresConfirmation: true,
			enabled: true,
			version: 1,
		});

		// Terminal Tool
		this.registerTool({
			id: 'terminal.run',
			name: 'Run Command',
			description: 'Execute a terminal command',
			type: 'terminal',
			category: 'System',
			parameters: [
				{ name: 'command', type: 'string', description: 'Command to execute', required: true },
				{ name: 'timeout', type: 'number', description: 'Timeout in ms', required: false, defaultValue: 60000 },
			],
			returns: { type: 'object', description: 'Command output and exit code' },
			permissions: ['execute'],
			timeoutMs: 120000,
			requiresConfirmation: true,
			enabled: true,
			version: 1,
		});

		// Search Tool
		this.registerTool({
			id: 'search.text',
			name: 'Search Text',
			description: 'Search for text in files',
			type: 'search',
			category: 'Search',
			parameters: [
				{ name: 'query', type: 'string', description: 'Search query', required: true },
				{ name: 'glob', type: 'string', description: 'File glob pattern', required: false, defaultValue: '**/*' },
				{ name: 'caseSensitive', type: 'boolean', description: 'Case sensitive search', required: false, defaultValue: false },
			],
			returns: { type: 'array', description: 'Search results with file paths and line numbers' },
			permissions: ['read'],
			timeoutMs: 60000,
			requiresConfirmation: false,
			enabled: true,
			version: 1,
		});

		// Git Tool
		this.registerTool({
			id: 'git.status',
			name: 'Git Status',
			description: 'Show working tree status',
			type: 'git',
			category: 'Version Control',
			parameters: [],
			returns: { type: 'object', description: 'Git status output' },
			permissions: ['read'],
			timeoutMs: 10000,
			requiresConfirmation: false,
			enabled: true,
			version: 1,
		});

		// HTTP Tool
		this.registerTool({
			id: 'http.request',
			name: 'HTTP Request',
			description: 'Make an HTTP request',
			type: 'http',
			category: 'Network',
			parameters: [
				{ name: 'url', type: 'string', description: 'Request URL', required: true },
				{ name: 'method', type: 'string', description: 'HTTP method', required: false, defaultValue: 'GET', enumValues: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
				{ name: 'headers', type: 'object', description: 'Request headers', required: false },
				{ name: 'body', type: 'string', description: 'Request body', required: false },
			],
			returns: { type: 'object', description: 'Response with status, headers, and body' },
			permissions: ['execute'],
			timeoutMs: 30000,
			requiresConfirmation: true,
			enabled: true,
			version: 1,
		});

		// Workspace Tool
		this.registerTool({
			id: 'workspace.list',
			name: 'List Workspace',
			description: 'List files in workspace',
			type: 'workspace',
			category: 'Workspace',
			parameters: [
				{ name: 'path', type: 'string', description: 'Path to list', required: false },
				{ name: 'recursive', type: 'boolean', description: 'List recursively', required: false, defaultValue: false },
			],
			returns: { type: 'array', description: 'File list with metadata' },
			permissions: ['read'],
			timeoutMs: 10000,
			requiresConfirmation: false,
			enabled: true,
			version: 1,
		});

		// Database Tool
		this.registerTool({
			id: 'database.query',
			name: 'Query Database',
			description: 'Execute a database query',
			type: 'database',
			category: 'Database',
			parameters: [
				{ name: 'query', type: 'string', description: 'SQL query', required: true },
				{ name: 'connectionId', type: 'string', description: 'Connection ID', required: false },
			],
			returns: { type: 'object', description: 'Query results' },
			permissions: ['read', 'write'],
			timeoutMs: 60000,
			requiresConfirmation: true,
			enabled: true,
			version: 1,
		});

		// Memory Tool
		this.registerTool({
			id: 'memory.store',
			name: 'Store Memory',
			description: 'Store a memory entry',
			type: 'memory',
			category: 'Memory',
			parameters: [
				{ name: 'key', type: 'string', description: 'Memory key', required: true },
				{ name: 'content', type: 'string', description: 'Memory content', required: true },
				{ name: 'type', type: 'string', description: 'Memory type', required: false, defaultValue: 'conversation', enumValues: ['conversation', 'agent', 'workspace', 'project', 'knowledge'] },
				{ name: 'tags', type: 'array', description: 'Memory tags', required: false },
			],
			returns: { type: 'string', description: 'Memory ID' },
			permissions: ['write'],
			timeoutMs: 5000,
			requiresConfirmation: false,
			enabled: true,
			version: 1,
		});
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private createExecutor(tool: IToolDefinition): void {
		const executor: ToolExecutor = {
			execute: async (params) => {
				// Placeholder implementation
				return `Executed ${tool.name} with params: ${JSON.stringify(params)}`;
			},
			cancel: () => { /* no-op */ },
		};

		this.executors.set(tool.id, executor);
	}

	private validateParameterType(param: IToolParameter, value: unknown): string[] {
		const errors: string[] = [];

		switch (param.type) {
			case 'string':
				if (typeof value !== 'string') {
					errors.push(`Parameter '${param.name}' must be a string`);
				}
				break;
			case 'number':
				if (typeof value !== 'number' || isNaN(value)) {
					errors.push(`Parameter '${param.name}' must be a number`);
				}
				break;
			case 'boolean':
				if (typeof value !== 'boolean') {
					errors.push(`Parameter '${param.name}' must be a boolean`);
				}
				break;
			case 'object':
				if (typeof value !== 'object' || value === null || Array.isArray(value)) {
					errors.push(`Parameter '${param.name}' must be an object`);
				}
				break;
			case 'array':
				if (!Array.isArray(value)) {
					errors.push(`Parameter '${param.name}' must be an array`);
				}
				break;
		}

		return errors;
	}

	private createErrorResult(
		toolId: string,
		correlationId: string | undefined,
		error: string
	): IToolResult {
		return {
			executionId: `exec-${Date.now()}`,
			toolId,
			success: false,
			content: '',
			error,
			executionTimeMs: 0,
			streaming: false,
		};
	}
}
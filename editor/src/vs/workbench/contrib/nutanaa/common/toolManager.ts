/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import {
	ToolType,
	ToolPermission,
	IToolDefinition,
	IToolParameter,
	IToolResult,
	IToolExecutionContext,
} from '../models/aiCore.js';

/**
 * Service for managing tools in Nutanaa Studio OS.
 *
 * Responsibilities:
 * - Tool registration and discovery
 * - Permission management
 * - Tool validation
 * - Tool execution
 * - Cancellation
 * - Streaming results
 */
export const IToolManager = createDecorator<IToolManager>('nutanaaToolManager');

export interface IToolManager {

	// ── Tool Registration ───────────────────────────────────────────────────────

	/**
	 * Register a new tool.
	 * @param tool The tool definition
	 * @returns True if registration succeeded
	 */
	registerTool(tool: IToolDefinition): boolean;

	/**
	 * Unregister a tool by ID.
	 * @param toolId The tool ID
	 * @returns True if unregistration succeeded
	 */
	unregisterTool(toolId: string): boolean;

	/**
	 * Update a tool definition.
	 * @param toolId The tool ID
	 * @param updates Partial updates
	 * @returns True if update succeeded
	 */
	updateTool(toolId: string, updates: Partial<IToolDefinition>): boolean;

	// ── Tool Discovery ─────────────────────────────────────────────────────────

	/**
	 * Get all registered tools.
	 * @returns Array of all tool definitions
	 */
	getAllTools(): IToolDefinition[];

	/**
	 * Get tool by ID.
	 * @param toolId The tool ID
	 * @returns Tool definition or undefined
	 */
	getTool(toolId: string): IToolDefinition | undefined;

	/**
	 * Get tool by name.
	 * @param name The tool name
	 * @returns Tool definition or undefined
	 */
	getToolByName(name: string): IToolDefinition | undefined;

	/**
	 * Get tools by type.
	 * @param type The tool type
	 * @returns Array of tool definitions
	 */
	getToolsByType(type: ToolType): IToolDefinition[];

	/**
	 * Get tools by category.
	 * @param category The tool category
	 * @returns Array of tool definitions
	 */
	getToolsByCategory(category: string): IToolDefinition[];

	/**
	 * Search tools by name or description.
	 * @param query Search query
	 * @returns Array of matching tool definitions
	 */
	searchTools(query: string): IToolDefinition[];

	// ── Permission Management ───────────────────────────────────────────────────

	/**
	 * Check if a tool can be executed with given permissions.
	 * @param toolId The tool ID
	 * @param userPermissions User's permissions
	 * @returns True if execution is allowed
	 */
	canExecute(toolId: string, userPermissions: ToolPermission[]): boolean;

	/**
	 * Get required permissions for a tool.
	 * @param toolId The tool ID
	 * @returns Array of required permissions
	 */
	getRequiredPermissions(toolId: string): ToolPermission[];

	/**
	 * Set tool permissions.
	 * @param toolId The tool ID
	 * @param permissions New permissions array
	 * @returns True if update succeeded
	 */
	setToolPermissions(toolId: string, permissions: ToolPermission[]): boolean;

	/**
	 * Enable or disable a tool.
	 * @param toolId The tool ID
	 * @param enabled New enabled state
	 * @returns True if update succeeded
	 */
	setToolEnabled(toolId: string, enabled: boolean): boolean;

	// ── Validation ─────────────────────────────────────────────────────────────

	/**
	 * Validate tool parameters.
	 * @param toolId The tool ID
	 * @param params Parameters to validate
	 * @returns Validation result with success and any errors
	 */
	validateParameters(toolId: string, params: Record<string, unknown>): { valid: boolean; errors: string[] };

	/**
	 * Validate a tool definition.
	 * @param tool The tool definition
	 * @returns Validation result
	 */
	validateTool(tool: IToolDefinition): { valid: boolean; errors: string[]; warnings: string[] };

	// ── Execution ───────────────────────────────────────────────────────────────

	/**
	 * Execute a tool.
	 * @param toolId The tool ID
	 * @param params Tool parameters
	 * @param context Execution context
	 * @returns Tool execution result
	 */
	execute(
		toolId: string,
		params: Record<string, unknown>,
		context?: IToolExecutionContext
	): Promise<IToolResult>;

	/**
	 * Execute a tool with streaming results.
	 * @param toolId The tool ID
	 * @param params Tool parameters
	 * @param context Execution context
	 * @returns Async iterable of result chunks
	 */
	stream(
		toolId: string,
		params: Record<string, unknown>,
		context?: IToolExecutionContext
	): AsyncIterable<string>;

	/**
	 * Cancel a tool execution.
	 * @param executionId The execution ID
	 * @returns True if cancellation succeeded
	 */
	cancel(executionId: string): boolean;

	/**
	 * Get execution status.
	 * @param executionId The execution ID
	 * @returns Execution result or undefined
	 */
	getExecutionStatus(executionId: string): IToolResult | undefined;

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when tool execution starts.
	 */
	onDidStartExecution: (listener: (result: IToolResult) => void) => { dispose(): void };

	/**
	 * Event fired when tool execution completes.
	 */
	onDidCompleteExecution: (listener: (result: IToolResult) => void) => { dispose(): void };

	/**
	 * Event fired when tool execution fails.
	 */
	onDidFailExecution: (listener: (result: IToolResult) => void) => { dispose(): void };

	/**
	 * Event fired when tools are registered or unregistered.
	 */
	onDidChangeTools: (listener: () => void) => { dispose(): void };
}
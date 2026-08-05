/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import {
	IContextEntry,
	IContextBuilderOptions,
	IContextBuildResult,
} from '../models/aiCore.js';

/**
 * Service for building AI context in Nutanaa Studio OS.
 *
 * Responsibilities:
 * - Build context from conversation history
 * - Inject relevant memories
 * - Include workspace context
 * - Token budgeting and truncation
 */
export const IContextBuilder = createDecorator<IContextBuilder>('nutanaaContextBuilder');

export interface IContextBuilder {

	// ── Context Building ───────────────────────────────────────────────────────

	/**
	 * Build context for an AI request.
	 * @param options Context building options
	 * @returns Built context result
	 */
	buildContext(options: IContextBuilderOptions): Promise<IContextBuildResult>;

	/**
	 * Build context from conversation history.
	 * @param options Options including max tokens and query
	 * @returns Array of context entries
	 */
	buildConversationContext(options: IContextBuilderOptions): Promise<IContextEntry[]>;

	/**
	 * Build context from memory.
	 * @param query The search query
	 * @param maxTokens Maximum tokens to use
	 * @returns Array of context entries
	 */
	buildMemoryContext(query: string, maxTokens: number): Promise<IContextEntry[]>;

	/**
	 * Build context from workspace files.
	 * @param query The search query
	 * @param maxTokens Maximum tokens to use
	 * @returns Array of context entries
	 */
	buildWorkspaceContext(query: string, maxTokens: number): Promise<IContextEntry[]>;

	/**
	 * Build context from editor state.
	 * @param currentFile The current file path
	 * @param selectedText Selected text if any
	 * @param maxTokens Maximum tokens to use
	 * @returns Array of context entries
	 */
	buildEditorContext(
		currentFile: string | undefined,
		selectedText: string | undefined,
		maxTokens: number
	): Promise<IContextEntry[]>;

	// ── Token Budgeting ───────────────────────────────────────────────────────

	/**
	 * Estimate token count for a context entry.
	 * @param entry The context entry
	 * @returns Estimated token count
	 */
	estimateTokenCount(entry: IContextEntry): number;

	/**
	 * Optimize context by importance within token budget.
	 * @param entries Context entries
	 * @param maxTokens Maximum tokens allowed
	 * @returns Optimized entries within budget
	 */
	optimizeContext(entries: IContextEntry[], maxTokens: number): IContextEntry[];

	// ── History Management ────────────────────────────────────────────────────

	/**
	 * Add a conversation entry.
	 * @param role Message role (user/assistant/tool)
	 * @param content The message content
	 * @param metadata Optional metadata
	 */
	addConversationEntry(role: string, content: string, metadata?: Record<string, unknown>): void;

	/**
	 * Clear conversation history.
	 */
	clearConversationHistory(): void;

	/**
	 * Get conversation history.
	 * @returns Array of conversation entries
	 */
	getConversationHistory(): IContextEntry[];

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when context is built.
	 */
	onDidBuildContext: (listener: (result: IContextBuildResult) => void) => { dispose(): void };
}
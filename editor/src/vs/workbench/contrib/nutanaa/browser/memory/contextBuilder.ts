/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import {
	IContextEntry,
	IContextBuilderOptions,
	IContextBuildResult,
} from '../../models/aiCore.js';
import { IContextBuilder } from '../../common/memory/contextBuilder.js';
import { IRuntimeStateService } from '../../common/runtime/runtimeState.js';

/**
 * ContextBuilder implementation for Nutanaa Studio OS.
 *
 * Builds AI context from conversation history, memory, workspace,
 * editor state, and other sources with token budgeting.
 */
export class ContextBuilder extends Disposable implements IContextBuilder {

	declare readonly _serviceBrand: undefined;

	private conversationHistory: IContextEntry[] = [];
	private readonly maxHistoryEntries = 100;

	private readonly _onDidBuildContext = this._register(new Emitter<IContextBuildResult>());

	public readonly onDidBuildContext = this._onDidBuildContext.event;

	constructor(
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	// ── Context Building ───────────────────────────────────────────────────────

	async buildContext(options: IContextBuilderOptions): Promise<IContextBuildResult> {
		const entries: IContextEntry[] = [];
		const includedSources: string[] = [];

		// Reserve tokens for system prompt if included
		let systemTokenReserve = 0;
		if (options.systemPrompt) {
			systemTokenReserve = this.estimateTokenCount({
				id: 'system-prompt',
				type: 'conversation',
				content: options.systemPrompt,
				importance: 1,
				source: 'system',
				timestamp: Date.now(),
				tokenCount: 0,
			});
		}

		const availableTokens = options.maxTokens - systemTokenReserve;

		// Build each context type
		if (options.includeConversationHistory && availableTokens > 0) {
			const historyEntries = await this.buildConversationContext(options);
			entries.push(...historyEntries);
			if (historyEntries.length > 0) {
				includedSources.push('conversation');
			}
		}

		if (options.includeMemory && availableTokens > 0) {
			const memoryEntries = await this.buildMemoryContext(
				options.userQuery || '',
				Math.floor(availableTokens * 0.3)
			);
			entries.push(...memoryEntries);
			if (memoryEntries.length > 0) {
				includedSources.push('memory');
			}
		}

		if (options.includeKnowledge && availableTokens > 0) {
			const knowledgeEntries = await this.buildMemoryContext(
				options.userQuery || '',
				Math.floor(availableTokens * 0.2)
			);
			entries.push(...knowledgeEntries);
			if (knowledgeEntries.length > 0) {
				includedSources.push('knowledge');
			}
		}

		if (options.includeWorkspaceContext && availableTokens > 0) {
			const workspaceEntries = await this.buildWorkspaceContext(
				options.userQuery || '',
				Math.floor(availableTokens * 0.2)
			);
			entries.push(...workspaceEntries);
			if (workspaceEntries.length > 0) {
				includedSources.push('workspace');
			}
		}

		if (options.includeEditorContext && availableTokens > 0) {
			const editorEntries = await this.buildEditorContext(
				options.currentFile,
				options.selectedText,
				Math.floor(availableTokens * 0.15)
			);
			entries.push(...editorEntries);
			if (editorEntries.length > 0) {
				includedSources.push('editor');
			}
		}

		if (options.includeExecutionContext && availableTokens > 0) {
			const executionEntries = await this.buildExecutionContext(
				Math.floor(availableTokens * 0.1)
			);
			entries.push(...executionEntries);
			if (executionEntries.length > 0) {
				includedSources.push('execution');
			}
		}

		if (options.includeToolContext && availableTokens > 0) {
			const toolEntries = await this.buildToolContext(
				Math.floor(availableTokens * 0.05)
			);
			entries.push(...toolEntries);
			if (toolEntries.length > 0) {
				includedSources.push('tool');
			}
		}

		// Calculate total tokens
		let totalTokens = systemTokenReserve;
		for (const entry of entries) {
			entry.tokenCount = this.estimateTokenCount(entry);
			totalTokens += entry.tokenCount;
		}

		// Truncate if over budget
		let truncated = false;
		if (totalTokens > options.maxTokens) {
			const optimized = this.optimizeContext(entries, options.maxTokens - systemTokenReserve);
			totalTokens = systemTokenReserve;
			for (const entry of optimized) {
				totalTokens += entry.tokenCount;
			}
			entries.length = 0;
			entries.push(...optimized);
			truncated = true;
		}

		const result: IContextBuildResult = {
			context: entries,
			totalTokens,
			truncated,
			includedSources,
		};

		// Fire event
		this._onDidBuildContext.fire(result);

		this.logService.debug(`Context built: ${entries.length} entries, ${totalTokens} tokens, truncated: ${truncated}`);

		return result;
	}

	async buildConversationContext(options: IContextBuilderOptions): Promise<IContextEntry[]> {
		// Filter and truncate history
		let relevantHistory = this.conversationHistory.filter(
			entry => entry.type === 'conversation'
		);

		// If there's a query, prioritize relevant entries
		if (options.userQuery) {
			relevantHistory = this.prioritizeByRelevance(relevantHistory, options.userQuery);
		}

		// Apply token budget
		const maxTokens = options.maxTokens;
		let tokenCount = 0;
		const selected: IContextEntry[] = [];

		for (const entry of relevantHistory) {
			const entryTokens = this.estimateTokenCount(entry);
			if (tokenCount + entryTokens > maxTokens) {
				break;
			}
			tokenCount += entryTokens;
			selected.push(entry);
		}

		return selected;
	}

	async buildMemoryContext(query: string, maxTokens: number): Promise<IContextEntry[]> {
		// Get memory entries from runtime state
		const state = this.runtimeStateService.getState();
		const memoryState = state.memory;

		const entries: IContextEntry[] = [];
		let tokenCount = 0;

		for (const memory of memoryState.recent || []) {
			const entryTokens = this.estimateTokenCount({
				id: memory.id,
				type: 'memory',
				content: memory.content,
				importance: memory.score,
				source: memory.type,
				timestamp: memory.timestamp,
				tokenCount: 0,
			});

			if (tokenCount + entryTokens > maxTokens) {
				break;
			}

			tokenCount += entryTokens;
			entries.push({
				id: memory.id,
				type: 'memory',
				content: memory.content,
				importance: memory.score,
				source: memory.type,
				timestamp: memory.timestamp,
				tokenCount: entryTokens,
			});
		}

		return entries;
	}

	async buildWorkspaceContext(query: string, maxTokens: number): Promise<IContextEntry[]> {
		// Placeholder for workspace context retrieval
		// This would integrate with the workspace service
		return [];
	}

	async buildEditorContext(
		currentFile: string | undefined,
		selectedText: string | undefined,
		maxTokens: number
	): Promise<IContextEntry[]> {
		const entries: IContextEntry[] = [];

		if (selectedText) {
			entries.push({
				id: 'selection',
				type: 'selection',
				content: selectedText,
				importance: 0.9,
				source: 'editor',
				timestamp: Date.now(),
				tokenCount: this.estimateTokenCount({
					id: 'selection',
					type: 'selection',
					content: selectedText,
					importance: 0.9,
					source: 'editor',
					timestamp: Date.now(),
					tokenCount: 0,
				}),
				metadata: { filePath: currentFile },
			});
		}

		return entries;
	}

	async buildExecutionContext(maxTokens: number): Promise<IContextEntry[]> {
		// Placeholder for execution context
		return [];
	}

	async buildToolContext(maxTokens: number): Promise<IContextEntry[]> {
		// Placeholder for tool context
		return [];
	}

	// ── Token Budgeting ───────────────────────────────────────────────────────

	estimateTokenCount(entry: IContextEntry): number {
		// Use actual token count if available
		if (entry.tokenCount > 0) {
			return entry.tokenCount;
		}

		// Rough estimate: 4 characters per token
		return Math.ceil(entry.content.length / 4);
	}

	optimizeContext(entries: IContextEntry[], maxTokens: number): IContextEntry[] {
		if (entries.length === 0) {
			return [];
		}

		// Sort by importance (descending)
		const sorted = [...entries].sort((a, b) => b.importance - a.importance);

		let tokenCount = 0;
		const selected: IContextEntry[] = [];

		for (const entry of sorted) {
			const entryTokens = this.estimateTokenCount(entry);
			if (tokenCount + entryTokens > maxTokens) {
				break;
			}
			tokenCount += entryTokens;
			selected.push(entry);
		}

		return selected;
	}

	// ── History Management ────────────────────────────────────────────────────

	addConversationEntry(role: string, content: string, metadata?: Record<string, unknown>): void {
		const entry: IContextEntry = {
			id: `conv-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			type: 'conversation',
			content,
			importance: role === 'user' ? 0.8 : 0.7,
			source: role,
			timestamp: Date.now(),
			tokenCount: 0,
			metadata,
		};

		this.conversationHistory.push(entry);

		// Trim old entries
		if (this.conversationHistory.length > this.maxHistoryEntries) {
			this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryEntries);
		}
	}

	clearConversationHistory(): void {
		this.conversationHistory = [];
	}

	getConversationHistory(): IContextEntry[] {
		return [...this.conversationHistory];
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private prioritizeByRelevance(entries: IContextEntry[], query: string): IContextEntry[] {
		// Simple keyword matching for relevance
		const queryWords = query.toLowerCase().split(/\s+/);
		const scored = entries.map(entry => {
			const content = entry.content.toLowerCase();
			let score = 0;
			for (const word of queryWords) {
				if (content.includes(word)) {
					score += 1;
				}
			}
			return { entry, score };
		});

		scored.sort((a, b) => b.score - a.score);
		return scored.map(s => s.entry);
	}
}
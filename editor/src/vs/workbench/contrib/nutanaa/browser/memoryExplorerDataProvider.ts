/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import {
	ITreeItem,
	ITreeViewDataProvider,
	TreeItemCollapsibleState
} from '../../../common/views.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IRuntimeStateService } from '../common/runtimeState.js';
import { IRuntimeEventBus, RuntimeEventType } from '../common/runtimeEventBus.js';
import { IMemoryEntry, MemoryType } from '../models/memoryModel.js';

/**
 * Memory Explorer Data Provider for Nutanaa Studio OS.
 *
 * Displays memories by type from RuntimeState.
 */
export class MemoryExplorerDataProvider extends Disposable implements ITreeViewDataProvider {

	private static readonly WORKSPACE_ID = 'memory-workspace';
	private static readonly PROJECT_ID = 'memory-project';
	private static readonly GLOBAL_ID = 'memory-global';
	private static readonly CHARACTER_ID = 'memory-character';
	private static readonly STORY_ID = 'memory-story';
	private static readonly PROMPTS_ID = 'memory-prompts';
	private static readonly VECTORDB_ID = 'memory-vectordb';
	private static readonly EMBEDDINGS_ID = 'memory-embeddings';

	private readonly _onDidChangeTreeData = this._register(new Emitter<ITreeItem[] | void>());
	readonly onDidChangeTreeData: Event<ITreeItem[] | void> = this._onDidChangeTreeData.event;

	constructor(
		@IRuntimeStateService private readonly stateService: IRuntimeStateService,
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
	) {
		super();

		this._register(this.stateService.onDidChangeState(() => this._onDidChangeTreeData.fire()));
		this._register(this.runtimeEventBus.on(RuntimeEventType.MemoryUpdated, () => this._onDidChangeTreeData.fire()));
		this._register(this.runtimeEventBus.on(RuntimeEventType.MemoryCleared, () => this._onDidChangeTreeData.fire()));
	}

	async getChildren(element?: ITreeItem): Promise<ITreeItem[]> {

		if (!element) {
			return this.buildRootItems();
		}

		const state = this.stateService.getState();

		switch (element.handle) {
			case MemoryExplorerDataProvider.WORKSPACE_ID:
				return this.buildMemoryItems(state, 'workspace');
			case MemoryExplorerDataProvider.PROJECT_ID:
				return this.buildMemoryItems(state, 'project');
			case MemoryExplorerDataProvider.GLOBAL_ID:
				return this.buildMemoryItems(state, 'global');
			case MemoryExplorerDataProvider.CHARACTER_ID:
				return this.buildMemoryItems(state, 'character');
			case MemoryExplorerDataProvider.STORY_ID:
				return this.buildMemoryItems(state, 'story');
			case MemoryExplorerDataProvider.PROMPTS_ID:
				return this.buildMemoryItems(state, 'prompt');
			case MemoryExplorerDataProvider.VECTORDB_ID:
				return this.buildVectorDbItems(state);
			case MemoryExplorerDataProvider.EMBEDDINGS_ID:
				return this.buildEmbeddingItems(state);
		}

		return [];
	}

	private buildRootItems(): ITreeItem[] {
		const state = this.stateService.getState();
		const memory = state.memory;
		const countByType = memory.countByType || {};

		return [
			{
				handle: MemoryExplorerDataProvider.WORKSPACE_ID,
				label: { label: `Workspace Memory (${countByType.workspace || 0})` },
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: 'nutanaaMemory.workspace',
			},
			{
				handle: MemoryExplorerDataProvider.PROJECT_ID,
				label: { label: `Project Memory (${countByType.project || 0})` },
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: 'nutanaaMemory.project',
			},
			{
				handle: MemoryExplorerDataProvider.GLOBAL_ID,
				label: { label: `Global Memory (${countByType.global || 0})` },
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: 'nutanaaMemory.global',
			},
			{
				handle: MemoryExplorerDataProvider.CHARACTER_ID,
				label: { label: `Character Memory (${countByType.character || 0})` },
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: 'nutanaaMemory.character',
			},
			{
				handle: MemoryExplorerDataProvider.STORY_ID,
				label: { label: `Story Bible (${countByType.story || 0})` },
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: 'nutanaaMemory.story',
			},
			{
				handle: MemoryExplorerDataProvider.PROMPTS_ID,
				label: { label: `Prompt Library (${countByType.prompt || 0})` },
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: 'nutanaaMemory.prompts',
			},
			{
				handle: MemoryExplorerDataProvider.VECTORDB_ID,
				label: { label: `Vector Database (${memory.embeddingStats?.totalChunks || 0} chunks)` },
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: 'nutanaaMemory.vectordb',
			},
			{
				handle: MemoryExplorerDataProvider.EMBEDDINGS_ID,
				label: { label: `Embeddings (${memory.embeddingStats?.totalEmbeddings || 0})` },
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: 'nutanaaMemory.embeddings',
			}
		];
	}

	private buildMemoryItems(state: ReturnType<IRuntimeStateService['getState']>, type: MemoryType): ITreeItem[] {
		const entries = state.memory.recentEntries?.filter(e => e.type === type) || [];

		if (entries.length === 0) {
			return [{
				handle: `${type}-none`,
				label: { label: `No ${type} memory` },
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaMemory.empty',
			}];
		}

		return entries.slice(0, 20).map(entry => ({
			handle: `${type}-${entry.id}`,
			label: { label: entry.key },
			description: new Date(entry.timestamp).toLocaleDateString(),
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: 'nutanaaMemory.entry',
		}));
	}

	private buildVectorDbItems(state: ReturnType<IRuntimeStateService['getState']>): ITreeItem[] {
		const embeddingStats = state.memory.embeddingStats;

		if (!embeddingStats || embeddingStats.totalChunks === 0) {
			return [{
				handle: 'vectordb-none',
				label: { label: 'No vector database entries' },
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaMemory.empty',
			}];
		}

		return [
			{
				handle: 'vectordb-chunks',
				label: { label: `${embeddingStats.totalChunks} chunks indexed` },
				description: `${embeddingStats.totalEmbeddings} embeddings`,
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaMemory.vectordbEntry',
			}
		];
	}

	private buildEmbeddingItems(state: ReturnType<IRuntimeStateService['getState']>): ITreeItem[] {
		const embeddingStats = state.memory.embeddingStats;

		if (!embeddingStats || embeddingStats.totalEmbeddings === 0) {
			return [{
				handle: 'embeddings-none',
				label: { label: 'No embeddings stored' },
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaMemory.empty',
			}];
		}

		return [
			{
				handle: 'embeddings-dimensions',
				label: { label: `${embeddingStats.averageDimensions}D vectors` },
				description: `Total: ${embeddingStats.totalEmbeddings}`,
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaMemory.embeddingEntry',
			}
		];
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import {
	ITreeItem,
	ITreeViewDataProvider,
	TreeItemCollapsibleState
} from '../../../common/views.js';
import { IRuntimeStateService } from '../common/runtimeState.js';
import { IRuntimeEventBus, RuntimeEventType } from '../common/runtimeEventBus.js';

/**
 * Project Knowledge Data Provider for Nutanaa Studio OS.
 *
 * Provides workspace knowledge data from RuntimeState.
 */
export class ProjectKnowledgeDataProvider extends Disposable implements ITreeViewDataProvider {

	private static readonly CODEBASE_ID = 'knowledge-codebase';
	private static readonly DOCS_ID = 'knowledge-docs';
	private static readonly RAG_ID = 'knowledge-rag';

	private readonly _onDidChangeTreeData = this._register(new Emitter<ITreeItem[] | void>());
	readonly onDidChangeTreeData: Event<ITreeItem[] | void> = this._onDidChangeTreeData.event;

	constructor(
		@IRuntimeStateService private readonly stateService: IRuntimeStateService,
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
	) {
		super();

		this._register(this.stateService.onDidChangeState(() => this._onDidChangeTreeData.fire()));
		this._register(this.runtimeEventBus.on(RuntimeEventType.KnowledgeIndexed, () => this._onDidChangeTreeData.fire()));
	}

	async getChildren(element?: ITreeItem): Promise<ITreeItem[]> {

		if (!element) {
			return this.buildRootItems();
		}

		const state = this.stateService.getState();
		
		switch (element.handle) {
			case ProjectKnowledgeDataProvider.CODEBASE_ID:
				return this.buildCodebaseItems(state);
			case ProjectKnowledgeDataProvider.DOCS_ID:
				return this.buildDocsItems(state);
			case ProjectKnowledgeDataProvider.RAG_ID:
				return this.buildRagItems(state);
		}

		return [];
	}

	private buildRootItems(): ITreeItem[] {
		const state = this.stateService.getState();
		const memory = state.memory;

		return [
			{
				handle: ProjectKnowledgeDataProvider.CODEBASE_ID,
				label: { label: `Codebase Knowledge (${memory.countByType?.workspace || 0})` },
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: 'nutanaaKnowledge.codebase',
			},
			{
				handle: ProjectKnowledgeDataProvider.DOCS_ID,
				label: { label: `Documentation (${memory.countByType?.knowledge || 0})` },
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: 'nutanaaKnowledge.docs',
			},
			{
				handle: ProjectKnowledgeDataProvider.RAG_ID,
				label: { label: `RAG Collections (${memory.embeddingStats?.totalChunks || 0} chunks)` },
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: 'nutanaaKnowledge.rag',
			}
		];
	}

	private buildCodebaseItems(state: ReturnType<IRuntimeStateService['getState']>): ITreeItem[] {
		const entries = state.memory.recentEntries?.filter(e => e.type === 'workspace') || [];

		if (entries.length === 0) {
			return [{
				handle: 'codebase-none',
				label: { label: 'No codebase knowledge indexed' },
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaKnowledge.empty',
			}];
		}

		return entries.slice(0, 10).map(entry => ({
			handle: `codebase-${entry.id}`,
			label: { label: entry.key },
			description: entry.type,
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: 'nutanaaKnowledge.entry',
		}));
	}

	private buildDocsItems(state: ReturnType<IRuntimeStateService['getState']>): ITreeItem[] {
		const entries = state.memory.recentEntries?.filter(e => e.type === 'knowledge') || [];

		if (entries.length === 0) {
			return [{
				handle: 'docs-none',
				label: { label: 'No documentation indexed' },
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaKnowledge.empty',
			}];
		}

		return entries.slice(0, 10).map(entry => ({
			handle: `docs-${entry.id}`,
			label: { label: entry.key },
			description: entry.type,
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: 'nutanaaKnowledge.entry',
		}));
	}

	private buildRagItems(state: ReturnType<IRuntimeStateService['getState']>): ITreeItem[] {
		const embeddingStats = state.memory.embeddingStats;

		if (!embeddingStats || embeddingStats.totalChunks === 0) {
			return [{
				handle: 'rag-none',
				label: { label: 'No RAG data indexed' },
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaKnowledge.empty',
			}];
		}

		return [
			{
				handle: 'rag-embeddings',
				label: { label: `Embeddings: ${embeddingStats.totalEmbeddings}` },
				description: `${embeddingStats.totalChunks} chunks, ${embeddingStats.averageDimensions}D`,
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaKnowledge.embeddings',
			}
		];
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}
}

// File: src/vs/workbench/contrib/nutanaa/services/workspaceMemoryService.ts

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { AgentMemory } from '../common/memory/agentMemory.js';
import { ConversationMemory } from '../common/memory/conversationMemory.js';
import { KnowledgeMemory } from '../common/memory/knowledgeMemory.js';
import { MemoryCleanup } from '../common/memory/memoryCleanup.js';
import { MemoryCompression } from '../common/memory/memoryCompression.js';
import { MemoryPersistence } from '../common/memory/memoryPersistence.js';
import { MemorySearch } from '../common/memory/memorySearch.js';
import { MemorySnapshots } from '../common/memory/memorySnapshots.js';
import { ProjectMemory } from '../common/memory/projectMemory.js';
import { WorkspaceMemory } from '../common/memory/workspaceMemory.js';
import { IMemoryEntry, IMemoryQuery, IMemorySearchResult, IMemorySnapshot } from '../models/memoryModel.js';

export const IWorkspaceMemoryService = createDecorator<IWorkspaceMemoryService>('workspaceMemoryService');

export interface IWorkspaceMemoryService {
	readonly _serviceBrand: undefined;
	readonly workspaceMemory: WorkspaceMemory;
	readonly conversationMemory: ConversationMemory;
	readonly agentMemory: AgentMemory;
	readonly projectMemory: ProjectMemory;
	readonly knowledgeMemory: KnowledgeMemory;

	getAllEntries(): IMemoryEntry[];
	search(query: IMemoryQuery): IMemorySearchResult[];
	compressConversationHistory(): IMemoryEntry;
	saveSnapshot(): IMemorySnapshot;
	exportJson(): string;
	importJson(json: string): void;
	pruneStaleMemories(maxAgeMs?: number): void;
}

export class WorkspaceMemoryService extends Disposable implements IWorkspaceMemoryService {
	declare readonly _serviceBrand: undefined;

	public readonly workspaceMemory = new WorkspaceMemory();
	public readonly conversationMemory = new ConversationMemory();
	public readonly agentMemory = new AgentMemory();
	public readonly projectMemory = new ProjectMemory();
	public readonly knowledgeMemory = new KnowledgeMemory();

	private readonly persistence = new MemoryPersistence();
	private readonly snapshots = new MemorySnapshots();

	public getAllEntries(): IMemoryEntry[] {
		return [
			...this.workspaceMemory.getAll(),
			...this.conversationMemory.getAllTurns(),
			...this.agentMemory.getAgentHistory(''),
			...this.projectMemory.getAllFacts(),
			...this.knowledgeMemory.getAllKnowledge()
		];
	}

	public search(query: IMemoryQuery): IMemorySearchResult[] {
		return MemorySearch.query(this.getAllEntries(), query);
	}

	public compressConversationHistory(): IMemoryEntry {
		const turns = this.conversationMemory.getAllTurns();
		const compressed = MemoryCompression.compressConversation(turns);
		this.conversationMemory.clear();
		return compressed;
	}

	public saveSnapshot(): IMemorySnapshot {
		return this.snapshots.createSnapshot(this.getAllEntries());
	}

	public exportJson(): string {
		return this.persistence.serialize(this.getAllEntries());
	}

	public importJson(json: string): void {
		const entries = this.persistence.deserialize(json);
		for (const entry of entries) {
			if (entry.type === 'workspace') {
				this.workspaceMemory.store(entry.key, entry.content, entry.tags, entry.metadata);
			} else if (entry.type === 'project') {
				this.projectMemory.setFact(entry.key, entry.content, entry.tags[1] || 'general');
			} else if (entry.type === 'knowledge') {
				this.knowledgeMemory.addKnowledge(entry.key, entry.content, entry.tags);
			}
		}
	}

	public pruneStaleMemories(maxAgeMs?: number): void {
		const entries = this.workspaceMemory.getAll();
		const fresh = MemoryCleanup.prune(entries, maxAgeMs);
		this.workspaceMemory.clear();
		for (const entry of fresh) {
			this.workspaceMemory.store(entry.key, entry.content, entry.tags, entry.metadata);
		}
	}
}
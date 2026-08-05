/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ITreeItem, ITreeViewDataProvider, TreeItemCollapsibleState } from '../../../common/views.js';
import { IRuntimeStateService } from '../common/runtimeState.js';

type EventCategory = 'agent' | 'workflow' | 'task' | 'system';

const CATEGORY_HANDLES: Record<EventCategory, string> = {
	agent:    'nutanaa.events.bucket.agent',
	workflow: 'nutanaa.events.bucket.workflow',
	task:     'nutanaa.events.bucket.task',
	system:   'nutanaa.events.bucket.system',
};

const CATEGORY_LABELS: Record<EventCategory, string> = {
	agent:    'Agent Events',
	workflow: 'Workflow Events',
	task:     'Task Events',
	system:   'System Events',
};

/**
 * Populates the Events tree from {@link IRuntimeStateService}.
 *
 * Events are synthesised from the live state slices (agents, workflows,
 * tasks) and the log ring-buffer (system events). The tree refreshes
 * whenever any of those slices change. No local cache.
 */
export class EventsDataProvider extends Disposable implements ITreeViewDataProvider {

	private readonly _onDidChangeTreeData = this._register(new Emitter<ITreeItem[] | void>());
	readonly onDidChangeTreeData: Event<ITreeItem[] | void> = this._onDidChangeTreeData.event;

	constructor(
		@IRuntimeStateService private readonly stateService: IRuntimeStateService,
	) {
		super();

		this._register(this.stateService.onAgentsChanged(() => this._onDidChangeTreeData.fire()));
		this._register(this.stateService.onWorkflowsChanged(() => this._onDidChangeTreeData.fire()));
		this._register(this.stateService.onTasksChanged(() => this._onDidChangeTreeData.fire()));
		this._register(this.stateService.onLogsChanged(() => this._onDidChangeTreeData.fire()));
	}

	async getChildren(element?: ITreeItem): Promise<readonly ITreeItem[]> {
		if (!element) {
			return this.buildCategoryItems();
		}

		const category = this.handleToCategory(element.handle);
		if (!category) {
			return [];
		}

		return this.buildCategoryChildren(category);
	}

	// ── Category roots ─────────────────────────────────────────────────────

	private buildCategoryItems(): ITreeItem[] {
		const categories: EventCategory[] = ['agent', 'workflow', 'task', 'system'];
		return categories.map(c => ({
			handle: CATEGORY_HANDLES[c],
			label: { label: localize(`nutanaa.events.bucket.${c}`, CATEGORY_LABELS[c]) },
			collapsibleState: TreeItemCollapsibleState.Collapsed,
			contextValue: `nutanaaEvents.bucket.${c}`,
		}));
	}

	// ── Per-category children ──────────────────────────────────────────────

	private buildCategoryChildren(category: EventCategory): ITreeItem[] {
		switch (category) {
			case 'agent':    return this.buildAgentEventItems();
			case 'workflow': return this.buildWorkflowEventItems();
			case 'task':     return this.buildTaskEventItems();
			case 'system':   return this.buildSystemEventItems();
		}
	}

	private buildAgentEventItems(): ITreeItem[] {
		const agents = Object.values(this.stateService.getState().agents);
		if (agents.length === 0) {
			return [this.emptyItem('nutanaa.events.agent.empty')];
		}
		return agents.map(a => ({
			handle: `nutanaa.events.agent.${a.summary.id}`,
			label: { label: a.summary.name },
			description: a.summary.status,
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: 'nutanaaEvents.agent',
		}));
	}

	private buildWorkflowEventItems(): ITreeItem[] {
		const workflows = Object.values(this.stateService.getState().workflows)
			.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
			.slice(0, 50);

		if (workflows.length === 0) {
			return [this.emptyItem('nutanaa.events.workflow.empty')];
		}
		return workflows.map(w => ({
			handle: `nutanaa.events.workflow.${w.id}`,
			label: { label: w.name },
			description: w.state,
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: 'nutanaaEvents.workflow',
		}));
	}

	private buildTaskEventItems(): ITreeItem[] {
		const tasks = Object.values(this.stateService.getState().tasks)
			.filter(t => t.state === 'running' || t.state === 'queued')
			.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
			.slice(0, 50);

		if (tasks.length === 0) {
			return [this.emptyItem('nutanaa.events.task.empty')];
		}
		return tasks.map(t => ({
			handle: `nutanaa.events.task.${t.id}`,
			label: { label: t.title },
			description: t.state,
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: 'nutanaaEvents.task',
		}));
	}

	private buildSystemEventItems(): ITreeItem[] {
		// System events are the most-recent error / warning log entries.
		const systemLogs = this.stateService.getState().logs
			.filter(e => e.level !== 'info')
			.slice()
			.reverse()
			.slice(0, 20);

		if (systemLogs.length === 0) {
			return [this.emptyItem('nutanaa.events.system.empty')];
		}
		return systemLogs.map(e => ({
			handle: `nutanaa.events.system.${e.id}`,
			label: { label: e.message },
			description: e.source ?? new Date(e.timestamp).toLocaleTimeString(),
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: `nutanaaEvents.system.${e.level}`,
		}));
	}

	// ── Helpers ────────────────────────────────────────────────────────────

	private emptyItem(handle: string): ITreeItem {
		return {
			handle,
			label: { label: localize('nutanaa.events.empty', 'No events') },
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: 'nutanaaEvents.empty',
		};
	}

	private handleToCategory(handle: string): EventCategory | undefined {
		for (const cat of Object.keys(CATEGORY_HANDLES) as EventCategory[]) {
			if (CATEGORY_HANDLES[cat] === handle) {
				return cat;
			}
		}
		return undefined;
	}
}

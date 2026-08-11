/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../../nls.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ITreeItem, ITreeViewDataProvider, TreeItemCollapsibleState } from '../../../../common/views.js';
import { IRuntimeStateService, ITaskState } from '../../common/runtime/runtimeState.js';

type TaskBucket = 'running' | 'queued' | 'completed' | 'failed' | 'cancelled';

const BUCKET_HANDLES: Record<TaskBucket, string> = {
	running:   'nutanaa.taskExplorer.bucket.running',
	queued:    'nutanaa.taskExplorer.bucket.queued',
	completed: 'nutanaa.taskExplorer.bucket.completed',
	failed:    'nutanaa.taskExplorer.bucket.failed',
	cancelled: 'nutanaa.taskExplorer.bucket.cancelled',
};

const BUCKET_LABELS: Record<TaskBucket, string> = {
	running:   'Running Tasks',
	queued:    'Queued Tasks',
	completed: 'Completed Tasks',
	failed:    'Failed Tasks',
	cancelled: 'Cancelled Tasks',
};

/**
 * Populates the Task Explorer tree from {@link IRuntimeStateService}.
 *
 * Tasks are grouped into five buckets. The tree re-renders automatically
 * whenever {@link IRuntimeStateService.onTasksChanged} fires — no local
 * cache, no duplicate polling.
 */
export class TaskExplorerDataProvider extends Disposable implements ITreeViewDataProvider {

	private readonly _onDidChangeTreeData = this._register(new Emitter<ITreeItem[] | void>());
	readonly onDidChangeTreeData: Event<ITreeItem[] | void> = this._onDidChangeTreeData.event;

	constructor(
		@IRuntimeStateService private readonly stateService: IRuntimeStateService,
	) {
		super();

		this._register(
			this.stateService.onTasksChanged(() => this._onDidChangeTreeData.fire())
		);
	}

	async getChildren(element?: ITreeItem): Promise<readonly ITreeItem[]> {
		if (!element) {
			return this.buildBucketItems();
		}

		const bucket = this.handleToBucket(element.handle);
		if (!bucket) {
			return [];
		}

		return this.buildTaskItems(bucket);
	}

	// ── Bucket root items ──────────────────────────────────────────────────

	private buildBucketItems(): ITreeItem[] {
		const tasks = Object.values(this.stateService.getState().tasks);
		const buckets: TaskBucket[] = ['running', 'queued', 'completed', 'failed', 'cancelled'];

		return buckets
			.filter(b => tasks.some(t => t.state === b))
			.map(b => ({
				handle: BUCKET_HANDLES[b],
				label: { label: localize(`nutanaa.taskExplorer.bucket.${b}`, BUCKET_LABELS[b]) },
				description: `${tasks.filter(t => t.state === b).length}`,
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: `nutanaaTaskExplorer.bucket.${b}`,
			}));
	}

	// ── Per-bucket task items ──────────────────────────────────────────────

	private buildTaskItems(bucket: TaskBucket): ITreeItem[] {
		const tasks = Object.values(this.stateService.getState().tasks)
			.filter(t => t.state === bucket)
			.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

		if (tasks.length === 0) {
			return [{
				handle: `nutanaa.taskExplorer.${bucket}.empty`,
				label: { label: localize('nutanaa.taskExplorer.empty', 'No tasks') },
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaTaskExplorer.empty',
			}];
		}

		return tasks.map(t => this.buildTaskItem(t));
	}

	private buildTaskItem(task: ITaskState): ITreeItem {
		return {
			handle: `nutanaa.taskExplorer.task.${task.id}`,
			label: { label: task.title },
			description: task.agentId ? `Agent: ${task.agentId}` : undefined,
			tooltip: task.errorMessage,
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: `nutanaaTaskExplorer.task.${task.state}`,
		};
	}

	// ── Helpers ────────────────────────────────────────────────────────────

	private handleToBucket(handle: string): TaskBucket | undefined {
		for (const bucket of Object.keys(BUCKET_HANDLES) as TaskBucket[]) {
			if (BUCKET_HANDLES[bucket] === handle) {
				return bucket;
			}
		}
		return undefined;
	}
}

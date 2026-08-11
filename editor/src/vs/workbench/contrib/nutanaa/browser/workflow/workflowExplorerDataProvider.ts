/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../../nls.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ITreeItem, ITreeViewDataProvider, TreeItemCollapsibleState } from '../../../../common/views.js';
import { IRuntimeStateService, IWorkflowState } from '../../common/runtime/runtimeState.js';

type WorkflowBucket = 'running' | 'created' | 'completed' | 'failed' | 'cancelled';

const BUCKET_HANDLES: Record<WorkflowBucket, string> = {
	running:   'nutanaa.workflowExplorer.bucket.running',
	created:   'nutanaa.workflowExplorer.bucket.created',
	completed: 'nutanaa.workflowExplorer.bucket.completed',
	failed:    'nutanaa.workflowExplorer.bucket.failed',
	cancelled: 'nutanaa.workflowExplorer.bucket.cancelled',
};

const BUCKET_LABELS: Record<WorkflowBucket, string> = {
	running:   'Running',
	created:   'Queued',
	completed: 'Completed',
	failed:    'Failed',
	cancelled: 'Cancelled',
};

/**
 * Populates the Workflow Explorer tree from {@link IRuntimeStateService}.
 *
 * Workflows are grouped into live status buckets. The tree re-renders
 * automatically whenever {@link IRuntimeStateService.onWorkflowsChanged} fires.
 * No local cache. No static hardcoded workflow names.
 */
export class WorkflowExplorerDataProvider extends Disposable implements ITreeViewDataProvider {

	private readonly _onDidChangeTreeData = this._register(new Emitter<ITreeItem[] | void>());
	readonly onDidChangeTreeData: Event<ITreeItem[] | void> = this._onDidChangeTreeData.event;

	constructor(
		@IRuntimeStateService private readonly stateService: IRuntimeStateService,
	) {
		super();

		this._register(
			this.stateService.onWorkflowsChanged(() => this._onDidChangeTreeData.fire())
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

		return this.buildWorkflowItems(bucket);
	}

	// ── Bucket root items ──────────────────────────────────────────────────

	private buildBucketItems(): ITreeItem[] {
		const workflows = Object.values(this.stateService.getState().workflows);
		const buckets: WorkflowBucket[] = ['running', 'created', 'completed', 'failed', 'cancelled'];

		// Show all buckets that have at least one workflow, plus always show
		// the running bucket even when empty (so operators know it exists).
		return buckets
			.filter(b => b === 'running' || workflows.some(w => w.state === b))
			.map(b => ({
				handle: BUCKET_HANDLES[b],
				label: { label: localize(`nutanaa.workflowExplorer.bucket.${b}`, BUCKET_LABELS[b]) },
				description: `${workflows.filter(w => w.state === b).length}`,
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: `nutanaaWorkflowExplorer.bucket.${b}`,
			}));
	}

	// ── Per-bucket workflow items ──────────────────────────────────────────

	private buildWorkflowItems(bucket: WorkflowBucket): ITreeItem[] {
		const workflows = Object.values(this.stateService.getState().workflows)
			.filter(w => w.state === bucket)
			.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

		if (workflows.length === 0) {
			return [{
				handle: `nutanaa.workflowExplorer.${bucket}.empty`,
				label: { label: localize('nutanaa.workflowExplorer.empty', 'No workflows') },
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaWorkflowExplorer.empty',
			}];
		}

		return workflows.map(w => this.buildWorkflowItem(w));
	}

	private buildWorkflowItem(workflow: IWorkflowState): ITreeItem {
		const durationLabel = workflow.completedAt && workflow.startedAt
			? `${Math.round((workflow.completedAt - workflow.startedAt) / 1000)}s`
			: undefined;

		return {
			handle: `nutanaa.workflowExplorer.workflow.${workflow.id}`,
			label: { label: workflow.name },
			description: durationLabel,
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: `nutanaaWorkflowExplorer.workflow.${workflow.state}`,
		};
	}

	// ── Helpers ────────────────────────────────────────────────────────────

	private handleToBucket(handle: string): WorkflowBucket | undefined {
		for (const bucket of Object.keys(BUCKET_HANDLES) as WorkflowBucket[]) {
			if (BUCKET_HANDLES[bucket] === handle) {
				return bucket;
			}
		}
		return undefined;
	}
}

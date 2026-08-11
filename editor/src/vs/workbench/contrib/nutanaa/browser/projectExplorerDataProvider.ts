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
import { IRuntimeStateService } from '../common/runtime/runtimeState.js';
import { IRuntimeEventBus, RuntimeEventType } from '../common/runtime/runtimeEventBus.js';

/**
 * Project Explorer Data Provider for Nutanaa Studio OS.
 *
 * Provides workspace and project data from RuntimeState and workspace services.
 */
export class ProjectExplorerDataProvider extends Disposable implements ITreeViewDataProvider {

	private static readonly RECENT_ID = 'recentProjects';
	private static readonly TEMPLATES_ID = 'templates';
	private static readonly WORKSPACE_ID = 'workspace';

	private readonly _onDidChangeTreeData = this._register(new Emitter<ITreeItem[] | void>());
	readonly onDidChangeTreeData: Event<ITreeItem[] | void> = this._onDidChangeTreeData.event;

	constructor(
		@IRuntimeStateService private readonly stateService: IRuntimeStateService,
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
	) {
		super();

		this._register(this.stateService.onDidChangeState(() => this._onDidChangeTreeData.fire()));
		this._register(this.runtimeEventBus.on(RuntimeEventType.WorkflowCreated, () => this._onDidChangeTreeData.fire()));
		this._register(this.runtimeEventBus.on(RuntimeEventType.MemoryUpdated, () => this._onDidChangeTreeData.fire()));
	}

	async getChildren(element?: ITreeItem): Promise<ITreeItem[]> {

		if (!element) {
			return this.buildRootItems();
		}

		const state = this.stateService.getState();

		switch (element.handle) {
			case ProjectExplorerDataProvider.RECENT_ID:
				return this.buildRecentProjects(state);
			case ProjectExplorerDataProvider.TEMPLATES_ID:
				return this.buildTemplates();
			case ProjectExplorerDataProvider.WORKSPACE_ID:
				return this.buildWorkspaceItems(state);
		}

		return [];
	}

	private buildRootItems(): ITreeItem[] {
		return [
			{
				handle: ProjectExplorerDataProvider.RECENT_ID,
				label: { label: 'Recent Projects' },
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: 'nutanaaProject.recent',
			},
			{
				handle: ProjectExplorerDataProvider.TEMPLATES_ID,
				label: { label: 'Project Templates' },
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: 'nutanaaProject.templates',
			},
			{
				handle: ProjectExplorerDataProvider.WORKSPACE_ID,
				label: { label: 'Workspace' },
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: 'nutanaaProject.workspace',
			}
		];
	}

	private buildRecentProjects(state: ReturnType<IRuntimeStateService['getState']>): ITreeItem[] {
		const workflows = Object.values(state.workflows);
		const recentProjects = new Map<string, { name: string; timestamp: number }>();

		for (const wf of workflows) {
			if (!recentProjects.has(wf.id)) {
				recentProjects.set(wf.id, {
					name: wf.name,
					timestamp: wf.createdAt
				});
			}
		}

		if (recentProjects.size === 0) {
			return [{
				handle: 'recent-none',
				label: { label: 'No recent projects' },
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaProject.empty',
			}];
		}

		return Array.from(recentProjects.values())
			.sort((a, b) => b.timestamp - a.timestamp)
			.slice(0, 10)
			.map(project => ({
				handle: `recent-${project.timestamp}`,
				label: { label: project.name },
				description: new Date(project.timestamp).toLocaleDateString(),
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaProject.recentItem',
			}));
	}

	private buildTemplates(): ITreeItem[] {
		return [
			{
				handle: 'template-python',
				label: { label: 'Python Agent Project' },
				description: 'Start with a Python-based AI agent',
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaProject.template',
			},
			{
				handle: 'template-typescript',
				label: { label: 'TypeScript Extension' },
				description: 'Build a VS Code extension',
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaProject.template',
			},
			{
				handle: 'template-workflow',
				label: { label: 'Workflow Project' },
				description: 'Create a workflow-based project',
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaProject.template',
			}
		];
	}

	private buildWorkspaceItems(state: ReturnType<IRuntimeStateService['getState']>): ITreeItem[] {
		const workflows = Object.values(state.workflows);
		const items: ITreeItem[] = [
			{
				handle: 'workspace-config',
				label: { label: 'workspace.json' },
				description: 'Workspace configuration',
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaProject.config',
			}
		];

		if (workflows.length > 0) {
			items.push({
				handle: 'workspace-workflows',
				label: { label: `Workflows (${workflows.length})` },
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: 'nutanaaProject.workflows',
			});
		}

		return items;
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}
}
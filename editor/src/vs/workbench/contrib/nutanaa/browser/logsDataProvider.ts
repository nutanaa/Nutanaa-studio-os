/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ITreeItem, ITreeViewDataProvider, TreeItemCollapsibleState } from '../../../common/views.js';
import { IRuntimeStateService, ILogEntry } from '../common/runtimeState.js';

type LogLevel = ILogEntry['level'];

const LEVEL_HANDLES: Record<LogLevel, string> = {
	info:    'nutanaa.logs.bucket.info',
	warning: 'nutanaa.logs.bucket.warning',
	error:   'nutanaa.logs.bucket.error',
};

const LEVEL_LABELS: Record<LogLevel, string> = {
	info:    'Info',
	warning: 'Warnings',
	error:   'Errors',
};

/**
 * Populates the Logs tree from {@link IRuntimeStateService}.
 *
 * Log entries are grouped by level. The tree refreshes automatically
 * whenever {@link IRuntimeStateService.onLogsChanged} fires. No local
 * buffer — all data comes from the live state ring-buffer.
 */
export class LogsDataProvider extends Disposable implements ITreeViewDataProvider {

	private readonly _onDidChangeTreeData = this._register(new Emitter<ITreeItem[] | void>());
	readonly onDidChangeTreeData: Event<ITreeItem[] | void> = this._onDidChangeTreeData.event;

	constructor(
		@IRuntimeStateService private readonly stateService: IRuntimeStateService,
	) {
		super();

		this._register(
			this.stateService.onLogsChanged(() => this._onDidChangeTreeData.fire())
		);
	}

	async getChildren(element?: ITreeItem): Promise<readonly ITreeItem[]> {
		if (!element) {
			return this.buildLevelBuckets();
		}

		const level = this.handleToLevel(element.handle);
		if (!level) {
			return [];
		}

		return this.buildLogItems(level);
	}

	// ── Level bucket roots ─────────────────────────────────────────────────

	private buildLevelBuckets(): ITreeItem[] {
		const logs = this.stateService.getState().logs;
		const levels: LogLevel[] = ['error', 'warning', 'info'];

		return levels
			.filter(l => logs.some(e => e.level === l))
			.map(l => ({
				handle: LEVEL_HANDLES[l],
				label: { label: localize(`nutanaa.logs.bucket.${l}`, LEVEL_LABELS[l]) },
				description: `${logs.filter(e => e.level === l).length}`,
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: `nutanaaLogs.bucket.${l}`,
			}));
	}

	// ── Per-level log items (most-recent first, capped at 200 per level) ──

	private buildLogItems(level: LogLevel): ITreeItem[] {
		const entries = this.stateService.getState().logs
			.filter(e => e.level === level)
			.slice()
			.reverse()
			.slice(0, 200);

		if (entries.length === 0) {
			return [{
				handle: `nutanaa.logs.${level}.empty`,
				label: { label: localize('nutanaa.logs.empty', 'No entries') },
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: 'nutanaaLogs.empty',
			}];
		}

		return entries.map(e => this.buildLogItem(e));
	}

	private buildLogItem(entry: ILogEntry): ITreeItem {
		const ts = new Date(entry.timestamp).toLocaleTimeString();
		return {
			handle: `nutanaa.logs.entry.${entry.id}`,
			label: { label: entry.message },
			description: entry.source ? `${entry.source}  ${ts}` : ts,
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: `nutanaaLogs.entry.${entry.level}`,
		};
	}

	// ── Helpers ────────────────────────────────────────────────────────────

	private handleToLevel(handle: string): LogLevel | undefined {
		for (const level of Object.keys(LEVEL_HANDLES) as LogLevel[]) {
			if (LEVEL_HANDLES[level] === handle) {
				return level;
			}
		}
		return undefined;
	}
}

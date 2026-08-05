/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import {
	IOfflineStatus,
	IQueuedOperation,
	ISyncOperation,
	IConflictResolution,
} from '../models/productionModel.js';
import { IOfflineManager } from '../common/offlineManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../common/runtimeEventBus.js';
import { IRuntimeStateService } from '../common/runtimeState.js';

/**
 * OfflineManager implementation for Nutanaa Studio OS Production.
 *
 * Provides offline support with queueing, sync, and conflict resolution.
 */
export class OfflineManager extends Disposable implements IOfflineManager {

	declare readonly _serviceBrand: undefined;

	private isCurrentlyOnline: boolean = true;
	private queuedOperations: IQueuedOperation[] = [];
	private syncOperations: ISyncOperation[] = [];
	private conflicts: IConflictResolution[] = [];
	private workspaceCaches = new Map<string, unknown>();

	private reconnectAttempts = 0;
	private reconnectStrategy: 'immediate' | 'delayed' | 'manual' = 'immediate';

	private readonly _onDidChangeStatus = this._register(new Emitter<{ isOnline: boolean }>());
	private readonly _onDidSync = this._register(new Emitter<{ success: boolean; synced: number; failed: number }>());
	private readonly _onDidDetectConflict = this._register(new Emitter<{ conflict: IConflictResolution }>());

	public readonly onDidChangeStatus = Event.fromEmitter(this._onDidChangeStatus);
	public readonly onDidSync = Event.fromEmitter(this._onDidSync);
	public readonly onDidDetectConflict = Event.fromEmitter(this._onDidDetectConflict);

	private syncInterval: ReturnType<typeof setInterval> | undefined;
	private networkMonitor: ReturnType<typeof setInterval> | undefined;

	private readonly SYNC_INTERVAL = 30000; // 30 seconds
	private readonly MAX_QUEUE_SIZE = 1000;
	private readonly MAX_RETRIES = 3;

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.initializeNetworkMonitoring();
		this.loadState();
	}

	private initializeNetworkMonitoring(): void {
		// Update online status
		const updateOnlineStatus = () => {
			const wasOnline = this.isCurrentlyOnline;
			this.isCurrentlyOnline = navigator.onLine;

			if (wasOnline !== this.isCurrentlyOnline) {
				this.handleStatusChange(wasOnline, this.isCurrentlyOnline);
			}
		};

		window.addEventListener('online', updateOnlineStatus);
		window.addEventListener('offline', updateOnlineStatus);

		// Monitor network status
		this.networkMonitor = setInterval(updateOnlineStatus, 5000);
	}

	private handleStatusChange(wasOnline: boolean, isNowOnline: boolean): void {
		const reason = isNowOnline ? 'network_restored' : 'network_lost';

		this._onDidChangeStatus.fire({ isOnline: isNowOnline });

		this.runtimeEventBus.fire({
			type: RuntimeEventType.OfflineModeChanged,
			timestamp: Date.now(),
			payload: { isOnline: isNowOnline, reason },
		});

		if (isNowOnline) {
			this.logService.info('Back online, starting sync');
			this.startSync();
		} else {
			this.logService.warn('Network offline, queueing operations');
		}

		this.updateProductionState();
	}

	// ── Status ───────────────────────────────────────────────────────────────

	getStatus(): IOfflineStatus {
		return {
			isOnline: this.isCurrentlyOnline,
			since: this.isCurrentlyOnline ? Date.now() : this.getLastOnline(),
			lastOnline: this.getLastOnline(),
			queuedOperations: this.queuedOperations.length,
			pendingSync: this.syncOperations.length,
		};
	}

	isOnline(): boolean {
		return this.isCurrentlyOnline;
	}

	getLastOnline(): number {
		const stored = this.storageService.get('offline.lastOnline', 0);
		return stored || Date.now();
	}

	// ── Queue Management ──────────────────────────────────────────────────────

	queueOperation(operation: Omit<IQueuedOperation, 'id' | 'timestamp' | 'retries'>): string {
		if (!this.isCurrentlyOnline) {
			if (this.queuedOperations.length >= this.MAX_QUEUE_SIZE) {
				this.logService.warn('Operation queue full, dropping oldest');
				this.queuedOperations.shift();
			}

			const queued: IQueuedOperation = {
				...operation,
				id: `op-${Date.now()}-${Math.random().toString(36).slice(2)}`,
				timestamp: Date.now(),
				retries: 0,
			};

			this.queuedOperations.push(queued);
			this.saveState();

			this.logService.debug(`Operation queued: ${operation.entity}/${operation.entityId}`);
			return queued.id;
		} else {
			// Online - execute immediately
			this.executeOperation(operation).catch(err => {
				this.logService.error(`Failed to execute operation: ${err}`);
			});
			return '';
		}
	}

	private async executeOperation(operation: Omit<IQueuedOperation, 'id' | 'timestamp' | 'retries'>): Promise<void> {
		// Simulate network operation
		await new Promise(resolve => setTimeout(resolve, 100));
		this.logService.debug(`Operation executed: ${operation.entity}/${operation.entityId}`);
	}

	getQueuedOperations(): IQueuedOperation[] {
		return [...this.queuedOperations];
	}

	getPendingCount(): number {
		return this.queuedOperations.filter(op => op.retries < this.MAX_RETRIES).length;
	}

	removeQueuedOperation(operationId: string): boolean {
		const index = this.queuedOperations.findIndex(op => op.id === operationId);
		if (index === -1) return false;

		this.queuedOperations.splice(index, 1);
		this.saveState();
		return true;
	}

	clearQueuedOperations(): number {
		const count = this.queuedOperations.length;
		this.queuedOperations = [];
		this.saveState();
		return count;
	}

	// ── Synchronization ───────────────────────────────────────────────────────

	async startSync(): Promise<void> {
		if (this.syncInterval) {
			return;
		}

		this.syncInterval = setInterval(() => {
			this.processSyncQueue();
		}, this.SYNC_INTERVAL);

		// Immediate sync
		await this.forceSync();
	}

	stopSync(): void {
		if (this.syncInterval) {
			clearInterval(this.syncInterval);
			this.syncInterval = undefined;
		}
	}

	async forceSync(): Promise<void> {
		if (!this.isCurrentlyOnline) {
			return;
		}

		let synced = 0;
		let failed = 0;

		// Process queued operations
		const toProcess = [...this.queuedOperations];
		this.queuedOperations = [];

		for (const op of toProcess) {
			try {
				await this.executeOperation({
					type: op.type,
					entity: op.entity,
					entityId: op.entityId,
					data: op.data,
					priority: op.priority,
				});
				synced++;
			} catch {
				op.retries++;
				if (op.retries < this.MAX_RETRIES) {
					this.queuedOperations.push(op);
				} else {
					failed++;
				}
			}
		}

		this._onDidSync.fire({ success: failed === 0, synced, failed });

		if (failed === 0) {
			this.reconnectAttempts = 0;
			this.storageService.store('offline.lastOnline', Date.now(), 0);
		}

		this.saveState();
	}

	private async processSyncQueue(): Promise<void> {
		if (!this.isCurrentlyOnline) {
			return;
		}

		await this.forceSync();
	}

	getSyncOperations(): ISyncOperation[] {
		return [...this.syncOperations];
	}

	// ── Conflict Resolution ───────────────────────────────────────────────────

	getConflicts(): IConflictResolution[] {
		return [...this.conflicts];
	}

	resolveConflict(
		entity: string,
		entityId: string,
		resolution: 'local' | 'remote' | 'merge',
		mergedData?: unknown
	): void {
		const index = this.conflicts.findIndex(c => c.entity === entity && c.entityId === entityId);
		if (index === -1) return;

		const conflict = this.conflicts[index];
		conflict.resolution = resolution;
		conflict.mergedData = mergedData as unknown;
		conflict.resolvedAt = Date.now();

		this.conflicts.splice(index, 1);
		this.saveState();

		this.logService.info(`Conflict resolved: ${entity}/${entityId} (${resolution})`);
	}

	// ── Workspace Cache ───────────────────────────────────────────────────────

	cacheWorkspaceData(workspaceId: string, data: unknown): void {
		this.workspaceCaches.set(workspaceId, {
			data,
			timestamp: Date.now(),
		});

		// Persist to storage
		const caches: Record<string, unknown> = {};
		for (const [id, cache] of this.workspaceCaches) {
			caches[id] = cache;
		}
		this.storageService.store('offline.workspaceCaches', JSON.stringify(caches), 0);
	}

	getWorkspaceData(workspaceId: string): unknown | undefined {
		const cache = this.workspaceCaches.get(workspaceId);
		if (!cache) {
			return undefined;
		}

		// Check if cache is expired (24 hours)
		if (Date.now() - cache.timestamp > 86400000) {
			this.workspaceCaches.delete(workspaceId);
			return undefined;
		}

		return cache.data;
	}

	clearWorkspaceCache(workspaceId: string): void {
		this.workspaceCaches.delete(workspaceId);
		this.saveWorkspaceCaches();
	}

	clearAllWorkspaceCaches(): void {
		this.workspaceCaches.clear();
		this.saveWorkspaceCaches();
	}

	// ── Reconnect Strategy ───────────────────────────────────────────────────

	setReconnectStrategy(strategy: 'immediate' | 'delayed' | 'manual'): void {
		this.reconnectStrategy = strategy;
		this.logService.info(`Reconnect strategy set to ${strategy}`);
	}

	getReconnectAttempts(): number {
		return this.reconnectAttempts;
	}

	resetReconnectAttempts(): void {
		this.reconnectAttempts = 0;
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private updateProductionState(): void {
		const status = this.getStatus();

		this.runtimeStateService.update({
			production: {
				telemetry: undefined,
				metricsHistory: undefined,
				cacheState: undefined,
				offlineStatus: status,
				backupStatus: undefined,
				healthSummary: undefined,
				updateInfo: undefined,
				updateProgress: undefined,
			},
		});
	}

	private loadState(): void {
		const stored = this.storageService.get('offline.queue', 0);
		if (stored) {
			try {
				this.queuedOperations = JSON.parse(stored);
			} catch {
				this.queuedOperations = [];
			}
		}

		const cachesStored = this.storageService.get('offline.workspaceCaches', 0);
		if (cachesStored) {
			try {
				const caches = JSON.parse(cachesStored);
				for (const [id, cache] of Object.entries(caches)) {
					this.workspaceCaches.set(id, cache as { data: unknown; timestamp: number });
				}
			} catch {
				this.workspaceCaches.clear();
			}
		}
	}

	private saveState(): void {
		this.storageService.store('offline.queue', JSON.stringify(this.queuedOperations), 0);
	}

	private saveWorkspaceCaches(): void {
		const caches: Record<string, unknown> = {};
		for (const [id, cache] of this.workspaceCaches) {
			caches[id] = cache;
		}
		this.storageService.store('offline.workspaceCaches', JSON.stringify(caches), 0);
	}

	override dispose(): void {
		this.stopSync();
		if (this.networkMonitor) {
			clearInterval(this.networkMonitor);
		}
		this.saveState();
		this.saveWorkspaceCaches();
		super.dispose();
	}
}
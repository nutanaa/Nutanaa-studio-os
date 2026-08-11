/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../../base/common/event.js';
import {
	IOfflineStatus,
	IQueuedOperation,
	ISyncOperation,
	IConflictResolution,
} from '../../models/productionModel.js';

/**
 * Service for offline support in Nutanaa Studio OS Production.
 *
 * Responsibilities:
 * - Offline detection
 * - Queued requests management
 * - Synchronization
 * - Conflict resolution
 * - Workspace caching
 * - Reconnect strategy
 */
export const IOfflineManager = createDecorator<IOfflineManager>('nutanaaOfflineManager');

export interface IOfflineManager {

	// ── Status ───────────────────────────────────────────────────────────────

	/**
	 * Get current offline status.
	 * @returns Status
	 */
	getStatus(): IOfflineStatus;

	/**
	 * Check if currently online.
	 * @returns True if online
	 */
	isOnline(): boolean;

	/**
	 * Get last online timestamp.
	 * @returns Timestamp
	 */
	getLastOnline(): number;

	// ── Online/Offline Events ─────────────────────────────────────────────────

	/**
	 * Event fired when online status changes.
	 */
onDidChangeStatus: Event<boolean>;

	// ── Queue Management ──────────────────────────────────────────────

	/**
	 * Queue an operation for sync.
	 * @param operation Operation to queue
	 * @returns Operation ID
	 */
	queueOperation(operation: Omit<IQueuedOperation, 'id' | 'timestamp' | 'retries'>): string;

	/**
	 * Get queued operations.
	 * @returns All queued operations
	 */
	getQueuedOperations(): IQueuedOperation[];

	/**
	 * Get pending operations count.
	 * @returns Count
	 */
	getPendingCount(): number;

	/**
	 * Remove an operation from queue.
	 * @param operationId Operation ID
	 * @returns True if removed
	 */
	removeQueuedOperation(operationId: string): boolean;

	/**
	 * Clear all queued operations.
	 * @returns Number cleared
	 */
	clearQueuedOperations(): number;

	// ── Synchronization ───────────────────────────────────────────────

	/**
	 * Start synchronization.
	 */
	startSync(): Promise<void>;

	/**
	 * Stop synchronization.
	 */
	stopSync(): void;

	/**
	 * Force sync now.
	 */
	forceSync(): Promise<void>;

	/**
	 * Get sync status.
	 * @returns Sync operations
	 */
	getSyncOperations(): ISyncOperation[];

	/**
	 * Event fired when sync completes.
	 */
	onDidSync: Event<{ success: boolean; synced: number; failed: number }>;

	// ── Conflict Resolution ───────────────────────────────────────────

	/**
	 * Get pending conflicts.
	 * @returns Conflicts
	 */
	getConflicts(): IConflictResolution[];

	/**
	 * Resolve a conflict.
	 * @param entity Entity type
	 * @param entityId Entity ID
	 * @param resolution Resolution strategy
	 * @param mergedData Merged data if applicable
	 */
	resolveConflict(
		entity: string,
		entityId: string,
		resolution: 'local' | 'remote' | 'merge',
		mergedData?: unknown
	): void;

	/**
	 * Event fired when conflict is detected.
	 */
	onDidDetectConflict: Event<IConflictResolution>;

	// ── Workspace Cache ───────────────────────────────────────────────────────

	/**
	 * Cache workspace data for offline.
	 * @param workspaceId Workspace ID
	 * @param data Data to cache
	 */
	cacheWorkspaceData(workspaceId: string, data: unknown): void;

	/**
	 * Get cached workspace data.
	 * @param workspaceId Workspace ID
	 * @returns Cached data or undefined
	 */
	getWorkspaceData(workspaceId: string): unknown | undefined;

	/**
	 * Clear workspace cache.
	 * @param workspaceId Workspace ID
	 */
	clearWorkspaceCache(workspaceId: string): void;

	/**
	 * Clear all workspace caches.
	 */
	clearAllWorkspaceCaches(): void;

	// ── Reconnect Strategy ───────────────────────────────────────────────────

	/**
	 * Set reconnect strategy.
	 * @param strategy Strategy
	 */
	setReconnectStrategy(strategy: 'immediate' | 'delayed' | 'manual'): void;

	/**
	 * Get reconnect attempts.
	 * @returns Attempts count
	 */
	getReconnectAttempts(): number;

	/**
	 * Reset reconnect attempts.
	 */
	resetReconnectAttempts(): void;
}
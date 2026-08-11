/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../../base/common/event.js';
import { IRecoveryConfig, IRecoveryPoint, ICrashRecovery } from '../../models/productionModel.js';

/**
 * Service for crash recovery in Nutanaa Studio OS Production.
 *
 * Responsibilities:
 * - Crash recovery
 * - Session restore
 * - Workflow recovery
 * - Task recovery
 * - Agent recovery
 * - Automatic restart
 */
export const IRecoveryManager = createDecorator<IRecoveryManager>('nutanaaRecoveryManager');

export interface IRecoveryManager {

	// ── Configuration ────────────────────────────────────────────────────────

	/**
	 * Get recovery configuration.
	 * @returns Config
	 */
	getConfig(): IRecoveryConfig;

	/**
	 * Update recovery configuration.
	 * @param config New configuration
	 */
	updateConfig(config: Partial<IRecoveryConfig>): void;

	// ── Recovery Points ──────────────────────────────────────────────────────

	/**
	 * Create a recovery point.
	 * @param type Recovery point type
	 * @param entityId Entity ID
	 * @param data Data to recover
	 * @returns Recovery point ID
	 */
	createRecoveryPoint(type: 'session' | 'workflow' | 'task' | 'agent', entityId: string, data: unknown): string;

	/**
	 * Get recovery points.
	 * @param type Optional type filter
	 * @returns Recovery points
	 */
	getRecoveryPoints(type?: string): IRecoveryPoint[];

	/**
	 * Get recovery point by ID.
	 * @param pointId Point ID
	 * @returns Recovery point or undefined
	 */
	getRecoveryPoint(pointId: string): IRecoveryPoint | undefined;

	/**
	 * Delete a recovery point.
	 * @param pointId Point ID
	 * @returns True if deleted
	 */
	deleteRecoveryPoint(pointId: string): boolean;

	/**
	 * Delete old recovery points.
	 * @param keep Number to keep
	 * @returns Number deleted
	 */
	deleteOldRecoveryPoints(keep: number): number;

	// ── Recovery Operations ──────────────────────────────────────────────────

	/**
	 * Recover a session.
	 * @param pointId Recovery point ID
	 * @returns Recovery result
	 */
	recoverSession(pointId: string): Promise<{
		success: boolean;
		data?: unknown;
		error?: string;
	}>;

	/**
	 * Recover a workflow.
	 * @param pointId Recovery point ID
	 * @returns Recovery result
	 */
	recoverWorkflow(pointId: string): Promise<{
		success: boolean;
		data?: unknown;
		error?: string;
	}>;

	/**
	 * Recover all sessions.
	 * @returns Recovery summary
	 */
	recoverAllSessions(): Promise<ICrashRecovery>;

	// ── Crash Handling ───────────────────────────────────────────────────────

	/**
	 * Handle a crash.
	 * @param crashData Crash data
	 * @returns Recovery result
	 */
	handleCrash(crashData: {
		error: string;
		stackTrace?: string;
		timestamp: number;
	}): Promise<ICrashRecovery>;

	/**
	 * Get last crash info.
	 * @returns Crash info or undefined
	 */
	getLastCrash(): {
		timestamp: number;
		error: string;
		recovered: boolean;
	} | undefined;

	/**
	 * Clear crash history.
	 */
	clearCrashHistory(): void;

	// ── Auto-Save ───────────────────────────────────────────────────────────

	/**
	 * Save current state for recovery.
	 * @param type State type
	 * @param entityId Entity ID
	 * @param state State to save
	 */
	saveState(type: string, entityId: string, state: unknown): void;

	/**
	 * Get saved state.
	 * @param type State type
	 * @param entityId Entity ID
	 * @returns Saved state or undefined
	 */
	getSavedState(type: string, entityId: string): unknown | undefined;

	/**
	 * Clear saved state.
	 * @param type State type
	 * @param entityId Entity ID
	 */
	clearSavedState(type: string, entityId: string): void;

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when crash is detected.
	 */
	onDidCrash: Event<{ error: string; timestamp: number }>;

	/**
	 * Event fired when recovery completes.
	 */
	onDidRecover: Event<ICrashRecovery>;
}
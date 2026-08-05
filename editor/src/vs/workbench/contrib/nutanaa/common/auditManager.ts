/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { AuditEventType, IAuditEvent, IAuditQuery } from '../models/enterpriseModel.js';

/**
 * Service for audit logging in Nutanaa Studio OS Enterprise.
 *
 * Responsibilities:
 * - Authentication event logging
 * - Permission change tracking
 * - Secret access auditing
 * - Plugin install/removal tracking
 * - Workflow execution logs
 * - Provider usage monitoring
 * - Security event alerts
 */
export const IAuditManager = createDecorator<IAuditManager>('nutanaaAuditManager');

export interface IAuditManager {

	// ── Logging ───────────────────────────────────────────────────────────────

	/**
	 * Log an audit event.
	 * @param event The event to log
	 */
	log(event: Omit<IAuditEvent, 'id' | 'timestamp'>): void;

	/**
	 * Log user login event.
	 * @param userId The user ID
	 * @param providerId The auth provider used
	 * @param success Whether login was successful
	 * @param metadata Additional metadata
	 */
	logUserLogin(userId: string, providerId: string, success: boolean, metadata?: Record<string, unknown>): void;

	/**
	 * Log user logout event.
	 * @param userId The user ID
	 * @param reason The logout reason
	 */
	logUserLogout(userId: string, reason: string): void;

	/**
	 * Log permission change.
	 * @param userId The user whose permissions changed
	 * @param changes Description of changes
	 * @param performedBy Who made the change
	 */
	logPermissionChange(userId: string, changes: string, performedBy: string): void;

	/**
	 * Log secret access.
	 * @param secretId The secret accessed
	 * @param userId Who accessed it
	 * @param accessType Type of access
	 */
	logSecretAccess(secretId: string, userId: string, accessType: 'read' | 'write' | 'admin'): void;

	/**
	 * Log plugin install.
	 * @param pluginId The plugin installed
	 * @param userId Who installed it
	 * @param version The plugin version
	 */
	logPluginInstall(pluginId: string, userId: string, version: string): void;

	/**
	 * Log plugin removal.
	 * @param pluginId The plugin removed
	 * @param userId Who removed it
	 */
	logPluginRemoval(pluginId: string, userId: string): void;

	/**
	 * Log workflow execution.
	 * @param workflowId The workflow executed
	 * @param userId Who executed it
	 * @param result The execution result
	 */
	logWorkflowExecution(workflowId: string, userId: string, result: 'success' | 'failure'): void;

	/**
	 * Log API request.
	 * @param endpoint The API endpoint
	 * @param method The HTTP method
	 * @param userId The user who made the request
	 * @param statusCode The response status code
	 */
	logApiRequest(endpoint: string, method: string, userId: string, statusCode: number): void;

	/**
	 * Log security alert.
	 * @param alertType The type of alert
	 * @param description The alert description
	 * @param severity Alert severity
	 */
	logSecurityAlert(alertType: string, description: string, severity: 'low' | 'medium' | 'high' | 'critical'): void;

	// ── Querying ──────────────────────────────────────────────────────────────

	/**
	 * Query audit events.
	 * @param query Query parameters
	 * @returns Array of matching events
	 */
	query(query: IAuditQuery): IAuditEvent[];

	/**
	 * Get recent events for a user.
	 * @param userId The user ID
	 * @param limit Maximum number of events
	 * @returns Array of events
	 */
	getRecentByUser(userId: string, limit?: number): IAuditEvent[];

	/**
	 * Get events by type.
	 * @param type Event type
	 * @param limit Maximum number of events
	 * @returns Array of events
	 */
	getByType(type: AuditEventType, limit?: number): IAuditEvent[];

	/**
	 * Get events for a resource.
	 * @param resourceType Resource type
	 * @param resourceId Resource ID
	 * @returns Array of events
	 */
	getByResource(resourceType: string, resourceId: string): IAuditEvent[];

	/**
	 * Get events within a time range.
	 * @param startTime Start time
	 * @param endTime End time
	 * @returns Array of events
	 */
	getByTimeRange(startTime: number, endTime: number): IAuditEvent[];

	// ── Statistics ────────────────────────────────────────────────────────────

	/**
	 * Get event count by type.
	 * @param startTime Start time
	 * @param endTime End time
	 * @returns Map of event type to count
	 */
	getEventCounts(startTime?: number, endTime?: number): Map<AuditEventType, number>;

	/**
	 * Get security alert summary.
	 * @param days Number of days to look back
	 * @returns Alert summary
	 */
	getSecurityAlertSummary(days: number): {
		total: number;
		bySeverity: Record<string, number>;
		recentAlerts: IAuditEvent[];
	};

	// ── Export ────────────────────────────────────────────────────────────────

	/**
	 * Export audit log to JSON.
	 * @param query Query parameters
	 * @returns JSON string
	 */
	exportToJson(query: IAuditQuery): string;

	/**
	 * Export audit log to CSV.
	 * @param query Query parameters
	 * @returns CSV string
	 */
	exportToCsv(query: IAuditQuery): string;

	// ── Cleanup ───────────────────────────────────────────────────────────────

	/**
	 * Archive old events.
	 * @param beforeDate Archive events before this date
	 * @returns Number of events archived
	 */
	archiveEvents(beforeDate: number): number;

	/**
	 * Delete old events.
	 * @param beforeDate Delete events before this date
	 * @returns Number of events deleted
	 */
	deleteEvents(beforeDate: number): number;

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when security alert is logged.
	 */
	onDidSecurityAlert: (listener: (event: IAuditEvent) => void) => { dispose(): void };

	/**
	 * Event fired when critical event is logged.
	 */
	onDidCriticalEvent: (listener: (event: IAuditEvent) => void) => { dispose(): void };
}
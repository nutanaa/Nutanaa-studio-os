/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { AuditEventType, IAuditEvent, IAuditQuery } from '../models/enterpriseModel.js';
import { IAuditManager } from '../common/auditManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../common/runtimeEventBus.js';
import { IRuntimeStateService } from '../common/runtimeState.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';

/**
 * AuditManager implementation for Nutanaa Studio OS Enterprise.
 *
 * Provides comprehensive audit logging for security, compliance, and monitoring.
 */
export class AuditManager extends Disposable implements IAuditManager {

	declare readonly _serviceBrand: undefined;

	private readonly events: IAuditEvent[] = [];
	private readonly _onDidSecurityAlert = this._register(new Emitter<IAuditEvent>());
	private readonly _onDidCriticalEvent = this._register(new Emitter<IAuditEvent>());

	public readonly onDidSecurityAlert = Event.fromEmitter(this._onDidSecurityAlert);
	public readonly onDidCriticalEvent = Event.fromEmitter(this._onDidCriticalEvent);

	private readonly MAX_EVENTS = 10000;
	private readonly ARCHIVE_THRESHOLD = 365 * 24 * 60 * 60 * 1000; // 1 year

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.loadEvents();
	}

	// ── Logging ───────────────────────────────────────────────────────────────

	log(event: Omit<IAuditEvent, 'id' | 'timestamp'>): void {
		const auditEvent: IAuditEvent = {
			...event,
			id: `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			timestamp: Date.now(),
		};

		this.events.push(auditEvent);

		// Trim events if exceeding limit
		if (this.events.length > this.MAX_EVENTS) {
			this.events.splice(0, this.events.length - this.MAX_EVENTS);
		}

		// Check for security alerts
		if (event.type.startsWith('security.') || event.type.startsWith('user.login_failed')) {
			this._onDidSecurityAlert.fire(auditEvent);

			if (event.type === 'security.alerts' && event.metadata?.severity === 'critical') {
				this._onDidCriticalEvent.fire(auditEvent);
			}
		}

		this.saveEvents();
		this.logService.debug(`Audit event: ${event.type}`);
	}

	logUserLogin(userId: string, providerId: string, success: boolean, metadata?: Record<string, unknown>): void {
		this.log({
			type: success ? 'user.login' : 'user.login_failed',
			userId,
			resourceType: 'session',
			action: `login_${providerId}`,
			result: success ? 'success' : 'failure',
			metadata: { providerId, ...metadata },
		});
	}

	logUserLogout(userId: string, reason: string): void {
		this.log({
			type: 'user.logout',
			userId,
			resourceType: 'session',
			action: 'logout',
			result: 'success',
			metadata: { reason },
		});
	}

	logPermissionChange(userId: string, changes: string, performedBy: string): void {
		this.log({
			type: 'permission.granted',
			userId,
			resourceType: 'permission',
			action: 'change',
			result: 'success',
			metadata: { changes, performedBy },
		});
	}

	logSecretAccess(secretId: string, userId: string, accessType: 'read' | 'write' | 'admin'): void {
		this.log({
			type: 'secret.accessed',
			userId,
			resourceType: 'secret',
			resourceId: secretId,
			action: accessType,
			result: 'success',
		});
	}

	logPluginInstall(pluginId: string, userId: string, version: string): void {
		this.log({
			type: 'plugin.installed',
			userId,
			resourceType: 'plugin',
			resourceId: pluginId,
			action: 'install',
			result: 'success',
			metadata: { version },
		});
	}

	logPluginRemoval(pluginId: string, userId: string): void {
		this.log({
			type: 'plugin.uninstalled',
			userId,
			resourceType: 'plugin',
			resourceId: pluginId,
			action: 'uninstall',
			result: 'success',
		});
	}

	logWorkflowExecution(workflowId: string, userId: string, result: 'success' | 'failure'): void {
		this.log({
			type: 'workflow.executed',
			userId,
			resourceType: 'workflow',
			resourceId: workflowId,
			action: 'execute',
			result: result,
		});
	}

	logApiRequest(endpoint: string, method: string, userId: string, statusCode: number): void {
		this.log({
			type: 'api.request',
			userId,
			resourceType: 'api',
			action: `${method} ${endpoint}`,
			result: statusCode < 400 ? 'success' : 'failure',
			errorMessage: statusCode >= 400 ? `HTTP ${statusCode}` : undefined,
		});
	}

	logSecurityAlert(alertType: string, description: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
		this.log({
			type: 'security.alerts',
			action: alertType,
			result: 'failure',
			metadata: { alertType, description, severity },
		});
	}

	// ── Querying ──────────────────────────────────────────────────────────────

	query(query: IAuditQuery): IAuditEvent[] {
		let results = [...this.events];

		// Filter by types
		if (query.types && query.types.length > 0) {
			results = results.filter(e => query.types!.includes(e.type));
		}

		// Filter by user IDs
		if (query.userIds && query.userIds.length > 0) {
			results = results.filter(e => e.userId && query.userIds!.includes(e.userId));
		}

		// Filter by resource types
		if (query.resourceTypes && query.resourceTypes.length > 0) {
			results = results.filter(e => e.resourceType && query.resourceTypes!.includes(e.resourceType));
		}

		// Filter by time range
		if (query.startTime) {
			results = results.filter(e => e.timestamp >= query.startTime!);
		}
		if (query.endTime) {
			results = results.filter(e => e.timestamp <= query.endTime!);
		}

		// Sort by timestamp descending
		results.sort((a, b) => b.timestamp - a.timestamp);

		// Apply limit
		if (query.limit) {
			results = results.slice(0, query.limit);
		}

		return results;
	}

	getRecentByUser(userId: string, limit = 50): IAuditEvent[] {
		return this.query({
			userIds: [userId],
			limit,
		});
	}

	getByType(type: AuditEventType, limit = 50): IAuditEvent[] {
		return this.query({
			types: [type],
			limit,
		});
	}

	getByResource(resourceType: string, resourceId: string): IAuditEvent[] {
		return this.query({
			resourceTypes: [resourceType],
		}).filter(e => e.resourceId === resourceId);
	}

	getByTimeRange(startTime: number, endTime: number): IAuditEvent[] {
		return this.query({
			startTime,
			endTime,
		});
	}

	// ── Statistics ────────────────────────────────────────────────────────────

	getEventCounts(startTime?: number, endTime?: number): Map<AuditEventType, number> {
		const counts = new Map<AuditEventType, number>();
		const filteredEvents = this.query({ startTime, endTime });

		for (const event of filteredEvents) {
			const count = counts.get(event.type) || 0;
			counts.set(event.type, count + 1);
		}

		return counts;
	}

	getSecurityAlertSummary(days: number): {
		total: number;
		bySeverity: Record<string, number>;
		recentAlerts: IAuditEvent[];
	} {
		const startTime = Date.now() - days * 24 * 60 * 60 * 1000;
		const securityEvents = this.query({
			startTime,
			types: ['security.alerts', 'user.login_failed'],
		});

		const bySeverity: Record<string, number> = {
			low: 0,
			medium: 0,
			high: 0,
			critical: 0,
		};

		for (const event of securityEvents) {
			const severity = (event.metadata?.severity as string) || 'low';
			bySeverity[severity] = (bySeverity[severity] || 0) + 1;
		}

		return {
			total: securityEvents.length,
			bySeverity,
			recentAlerts: securityEvents.slice(0, 10),
		};
	}

	// ── Export ────────────────────────────────────────────────────────────────

	exportToJson(query: IAuditQuery): string {
		const events = this.query(query);
		return JSON.stringify(events, null, 2);
	}

	exportToCsv(query: IAuditQuery): string {
		const events = this.query(query);

		const headers = ['ID', 'Timestamp', 'Type', 'User ID', 'Resource Type', 'Resource ID', 'Action', 'Result'];
		const rows = events.map(e => [
			e.id,
			new Date(e.timestamp).toISOString(),
			e.type,
			e.userId || '',
			e.resourceType || '',
			e.resourceId || '',
			e.action,
			e.result,
		]);

		return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
	}

	// ── Cleanup ───────────────────────────────────────────────────────────────

	archiveEvents(beforeDate: number): number {
		const toArchive = this.events.filter(e => e.timestamp < beforeDate);
		this.events = this.events.filter(e => e.timestamp >= beforeDate);

		if (toArchive.length > 0) {
			this.logService.info(`Archived ${toArchive.length} audit events`);
			this.saveEvents();
		}

		return toArchive.length;
	}

	deleteEvents(beforeDate: number): number {
		const toDelete = this.events.filter(e => e.timestamp < beforeDate).length;
		this.events = this.events.filter(e => e.timestamp >= beforeDate);

		if (toDelete > 0) {
			this.logService.info(`Deleted ${toDelete} audit events`);
			this.saveEvents();
		}

		return toDelete;
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private loadEvents(): void {
		const stored = this.storageService.get('nutanaa.audit', 0);
		if (stored) {
			try {
				const data = JSON.parse(stored);
				this.events = data.events || [];
			} catch {
				this.events = [];
			}
		}
	}

	private saveEvents(): void {
		// Limit stored events to prevent excessive storage usage
		const eventsToStore = this.events.slice(-5000);

		this.storageService.store('nutanaa.audit', JSON.stringify({
			events: eventsToStore,
			lastSaved: Date.now(),
		}), 0);
	}
}
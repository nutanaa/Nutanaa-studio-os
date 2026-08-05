/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Every event flowing through Nutanaa Runtime passes through the RuntimeEventBus.
 *
 * Nothing should communicate directly.
 *
 * RuntimeConnectionService
 * AgentCoordinator
 * ProviderManager
 * WorkflowManager
 * MemoryManager
 * UI Views
 * Logs
 *
 * all communicate using these event types.
 */

export const enum RuntimeEventType {

	/* Runtime */

	RuntimeConnected,

	RuntimeDisconnected,

	RuntimeConnecting,

	RuntimeReconnect,

	RuntimeError,

	/* Agents */

	AgentRegistered,

	AgentUnregistered,

	AgentQueued,

	AgentStarted,

	AgentRunning,

	AgentCompleted,

	AgentFailed,

	AgentCancelled,

	/* Providers */

	ProviderRegistered,

	ProviderRemoved,

	ProviderChanged,

	ProviderHealthy,

	ProviderUnhealthy,

	/* Workflows */

	WorkflowCreated,

	WorkflowStarted,

	WorkflowRunning,

	WorkflowCompleted,

	WorkflowFailed,

	WorkflowCancelled,

	/* Tasks */

	TaskQueued,

	TaskStarted,

	TaskCompleted,

	TaskFailed,

	TaskCancelled,

	/* Memory */

	MemoryUpdated,

	MemoryCleared,

	KnowledgeIndexed,

	/* Logs */

	Log,

	Warning,

	Error,

	/* UI */

	ViewChanged,

	PanelOpened,

	PanelClosed,

	SelectionChanged,

	/* Notifications */

	Notification
}

/**
 * Generic Runtime Event.
 */

export interface RuntimeEvent<T = unknown> {

	readonly type: RuntimeEventType;

	readonly timestamp: number;

	readonly payload: T;
}

/**
 * Agent Event Payload
 */

export interface AgentEvent {

	id: string;

	name: string;

	status: string;

	message?: string;
}

/**
 * Provider Event Payload
 */

export interface ProviderEvent {

	name: string;

	status: string;

	model?: string;

	healthy?: boolean;
}

/**
 * Workflow Event Payload
 */

export interface WorkflowEvent {

	id: string;

	name: string;

	state: string;
}

/**
 * Task Event Payload
 */

export interface TaskEvent {

	id: string;

	title: string;

	state: string;
}

/**
 * Log Event Payload
 */

export interface LogEvent {

	level: 'info' | 'warning' | 'error';

	message: string;

	source?: string;
}

/**
 * Notification Payload
 */

export interface NotificationEvent {

	title: string;

	message: string;
}
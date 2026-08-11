/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IRemoteAgent } from '../../models/enterpriseModel.js';

/**
 * Service for managing remote agents in Nutanaa Studio OS Enterprise.
 *
 * Responsibilities:
 * - Remote runtime registration and discovery
 * - Remote execution coordination
 * - Agent synchronization across nodes
 * - Heartbeat monitoring
 * - Failover and load balancing
 * - Remote monitoring and diagnostics
 */
export const IRemoteAgentManager = createDecorator<IRemoteAgentManager>('nutanaaRemoteAgentManager');

export interface IRemoteAgentManager {

	// ── Registration ───────────────────────────────────────────────────────────

	/**
	 * Register a remote agent.
	 * @param agent The agent to register
	 * @returns Registered agent
	 */
	registerRemoteAgent(agent: Omit<IRemoteAgent, 'id' | 'status' | 'lastHeartbeat'>): IRemoteAgent;

	/**
	 * Unregister a remote agent.
	 * @param agentId The agent ID
	 */
	unregisterRemoteAgent(agentId: string): void;

	/**
	 * Get agent by ID.
	 * @param agentId The agent ID
	 * @returns Agent or undefined
	 */
	getRemoteAgent(agentId: string): IRemoteAgent | undefined;

	/**
	 * Get all registered agents.
	 * @returns Array of agents
	 */
	getAllRemoteAgents(): IRemoteAgent[];

	/**
	 * Get agents by status.
	 * @param status The status to filter by
	 * @returns Array of agents
	 */
	getAgentsByStatus(status: 'connected' | 'disconnected' | 'connecting' | 'error'): IRemoteAgent[];

	// ── Connection Management ─────────────────────────────────────────────────

	/**
	 * Connect to a remote agent.
	 * @param endpoint The agent endpoint
	 * @returns Connected agent
	 */
	connectToAgent(endpoint: string): Promise<IRemoteAgent>;

	/**
	 * Disconnect from a remote agent.
	 * @param agentId The agent ID
	 */
	disconnectFromAgent(agentId: string): void;

	/**
	 * Reconnect to a disconnected agent.
	 * @param agentId The agent ID
	 * @returns Reconnected agent
	 */
	reconnectToAgent(agentId: string): Promise<IRemoteAgent>;

	// ── Heartbeat ────────────────────────────────────────────────────────────

	/**
	 * Send heartbeat for an agent.
	 * @param agentId The agent ID
	 */
	sendHeartbeat(agentId: string): void;

	/**
	 * Start heartbeat monitoring for an agent.
	 * @param agentId The agent ID
	 */
	startHeartbeatMonitoring(agentId: string): void;

	/**
	 * Stop heartbeat monitoring for an agent.
	 * @param agentId The agent ID
	 */
	stopHeartbeatMonitoring(agentId: string): void;

	/**
	 * Get agents with stale heartbeats.
	 * @param thresholdMs Stale threshold in milliseconds
	 * @returns Array of agents with stale heartbeats
	 */
	getAgentsWithStaleHeartbeats(thresholdMs: number): IRemoteAgent[];

	// ── Execution ─────────────────────────────────────────────────────────────

	/**
	 * Execute a task on a remote agent.
	 * @param agentId The agent ID
	 * @param task The task definition
	 * @returns Execution result
	 */
	executeOnRemoteAgent(
		agentId: string,
		task: { command: string; args?: unknown[]; options?: Record<string, unknown> }
	): Promise<{ success: boolean; result?: unknown; error?: string }>;

	/**
	 * Sync agent state from remote.
	 * @param agentId The agent ID
	 * @returns Synchronized state
	 */
	syncAgentState(agentId: string): Promise<Record<string, unknown>>;

	// ── Failover ──────────────────────────────────────────────────────────────

	/**
	 * Trigger failover to a backup agent.
	 * @param agentId The failed agent ID
	 * @returns New agent
	 */
	failoverToBackup(agentId: string): Promise<IRemoteAgent>;

	/**
	 * Get backup agents for a given agent.
	 * @param agentId The primary agent ID
	 * @returns Array of backup agents
	 */
	getBackupAgents(agentId: string): IRemoteAgent[];

	// ── Monitoring ───────────────────────────────────────────────────────────

	/**
	 * Get agent load metrics.
	 * @param agentId The agent ID
	 * @returns Load metrics
	 */
	getAgentLoad(agentId: string): Promise<{ cpu: number; memory: number; tasks: number }>;

	/**
	 * Get all agent metrics.
	 * @returns Map of agent ID to metrics
	 */
	getAllAgentMetrics(): Promise<Map<string, { cpu: number; memory: number; tasks: number }>>;

	/**
	 * Run diagnostics on an agent.
	 * @param agentId The agent ID
	 * @returns Diagnostic results
	 */
	runDiagnostics(agentId: string): Promise<{
		connection: boolean;
		latency: number;
		capabilities: string[];
		issues: string[];
	}>;

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when agent connects.
	 */
	readonly onDidAgentConnect: import('../../../../../base/common/event.js').Event<IRemoteAgent>;

	/**
	 * Event fired when agent disconnects.
	 */
	readonly onDidAgentDisconnect: import('../../../../../base/common/event.js').Event<{ agentId: string; reason: string }>;

	/**
	 * Event fired when agent status changes.
	 */
	readonly onDidAgentStatusChange: import('../../../../../base/common/event.js').Event<{ agentId: string; status: IRemoteAgent['status'] }>;

	/**
	 * Event fired when heartbeat is missed.
	 */
	readonly onDidMissHeartbeat: import('../../../../../base/common/event.js').Event<{ agentId: string }>;
}
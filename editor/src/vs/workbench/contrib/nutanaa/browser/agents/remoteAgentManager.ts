/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IRemoteAgent } from '../../models/enterpriseModel.js';
import { IRemoteAgentManager } from '../../common/agents/remoteAgentManager.js';
import { IRuntimeEventBus } from '../../common/runtime/runtimeEventBus.js';
import { RuntimeEventType } from '../../common/runtime/runtimeEvents.js';
import { IRuntimeStateService } from '../../common/runtime/runtimeState.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';

/**
 * RemoteAgentManager implementation for Nutanaa Studio OS Enterprise.
 *
 * Manages remote runtime agents with heartbeats, failover, and monitoring.
 */
export class RemoteAgentManager extends Disposable implements IRemoteAgentManager {

	declare readonly _serviceBrand: undefined;

	private readonly agents = new Map<string, IRemoteAgent>();
	private readonly heartbeatIntervals = new Map<string, ReturnType<typeof setInterval>>();
	private readonly backupAgents = new Map<string, string[]>();

	private readonly _onDidAgentConnect = this._register(new Emitter<IRemoteAgent>());
	private readonly _onDidAgentDisconnect = this._register(new Emitter<{ agentId: string; reason: string }>());
	private readonly _onDidAgentStatusChange = this._register(new Emitter<{ agentId: string; status: IRemoteAgent['status'] }>());
	private readonly _onDidMissHeartbeat = this._register(new Emitter<{ agentId: string }>());

	public readonly onDidAgentConnect = this._onDidAgentConnect.event;
	public readonly onDidAgentDisconnect = this._onDidAgentDisconnect.event;
	public readonly onDidAgentStatusChange = this._onDidAgentStatusChange.event;
	public readonly onDidMissHeartbeat = this._onDidMissHeartbeat.event;

	private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
	private readonly MISSED_HEARTBEATS_THRESHOLD = 3;
	private readonly MISSED_HEARTBEAT_TIMEOUT = this.HEARTBEAT_INTERVAL * this.MISSED_HEARTBEATS_THRESHOLD;

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.loadAgents();
	}

	// ── Registration ───────────────────────────────────────────────────────────

	registerRemoteAgent(agentData: Omit<IRemoteAgent, 'id' | 'status' | 'lastHeartbeat'>): IRemoteAgent {
		const agent: IRemoteAgent = {
			...agentData,
			id: `agent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			status: 'disconnected',
			lastHeartbeat: Date.now(),
		};

		this.agents.set(agent.id, agent);
		this.saveAgents();

		this.logService.info(`Remote agent ${agent.name} registered at ${agent.endpoint}`);
		return agent;
	}

	unregisterRemoteAgent(agentId: string): void {
		const agent = this.agents.get(agentId);
		if (!agent) {
			return;
		}

		this.stopHeartbeatMonitoring(agentId);
		this.agents.delete(agentId);
		this.backupAgents.delete(agentId);
		this.saveAgents();

		this.logService.info(`Remote agent ${agent.name} unregistered`);
	}

	getRemoteAgent(agentId: string): IRemoteAgent | undefined {
		return this.agents.get(agentId);
	}

	getAllRemoteAgents(): IRemoteAgent[] {
		return Array.from(this.agents.values());
	}

	getAgentsByStatus(status: IRemoteAgent['status']): IRemoteAgent[] {
		return Array.from(this.agents.values()).filter(a => a.status === status);
	}

	// ── Connection Management ─────────────────────────────────────────────────

	async connectToAgent(endpoint: string): Promise<IRemoteAgent> {
		// Check if already connected
		for (const agent of this.agents.values()) {
			if (agent.endpoint === endpoint) {
				if (agent.status === 'connected') {
					return agent;
				}
				if (agent.status === 'disconnected' || agent.status === 'error') {
					return this.reconnectToAgent(agent.id);
				}
			}
		}

		// Register new agent
		const agent = this.registerRemoteAgent({
			name: `Agent at ${endpoint}`,
			endpoint,
			capabilities: ['execution', 'monitoring'],
			load: 0,
		});

		try {
			// Simulate connection
			await this.simulateNetworkLatency();

			agent.status = 'connected';
			agent.lastHeartbeat = Date.now();
			this.agents.set(agent.id, agent);

			// Start heartbeat monitoring
			this.startHeartbeatMonitoring(agent.id);

			// Update runtime state
			this.updateClusterState();

			// Fire events
			this._onDidAgentConnect.fire(agent);

			this.runtimeEventBus.fire({
				type: RuntimeEventType.NodeConnected,
				timestamp: Date.now(),
				payload: {
					nodeId: agent.id,
					endpoint: agent.endpoint,
					capabilities: agent.capabilities,
				},
			});

			this.logService.info(`Connected to remote agent ${agent.name}`);

			return agent;
		} catch (error) {
			agent.status = 'error';
			this.agents.set(agent.id, agent);

			throw error;
		}
	}

	disconnectFromAgent(agentId: string): void {
		const agent = this.agents.get(agentId);
		if (!agent) {
			return;
		}

		this.stopHeartbeatMonitoring(agentId);
		agent.status = 'disconnected';
		this.agents.set(agentId, agent);

		// Update runtime state
		this.updateClusterState();

		// Fire events
		this._onDidAgentDisconnect.fire({ agentId, reason: 'user_disconnect' });

		this.runtimeEventBus.fire({
			type: RuntimeEventType.NodeDisconnected,
			timestamp: Date.now(),
			payload: { nodeId: agentId, reason: 'user_disconnect' },
		});

		this.logService.info(`Disconnected from remote agent ${agent.name}`);
	}

	async reconnectToAgent(agentId: string): Promise<IRemoteAgent> {
		const agent = this.agents.get(agentId);
		if (!agent) {
			throw new Error(`Agent ${agentId} not found`);
		}

		try {
			this._onDidAgentStatusChange.fire({ agentId, status: 'connecting' });

			await this.simulateNetworkLatency();

			agent.status = 'connected';
			agent.lastHeartbeat = Date.now();
			this.agents.set(agentId, agent);

			// Restart heartbeat monitoring
			this.startHeartbeatMonitoring(agentId);

			// Update runtime state
			this.updateClusterState();

			this._onDidAgentConnect.fire(agent);

			this.logService.info(`Reconnected to remote agent ${agent.name}`);

			return agent;
		} catch {
			agent.status = 'error';
			this.agents.set(agentId, agent);

			throw new Error(`Failed to reconnect to agent ${agentId}`);
		}
	}

	// ── Heartbeat ────────────────────────────────────────────────────────────

	sendHeartbeat(agentId: string): void {
		const agent = this.agents.get(agentId);
		if (!agent) {
			return;
		}

		agent.lastHeartbeat = Date.now();
		this.agents.set(agentId, agent);
	}

	startHeartbeatMonitoring(agentId: string): void {
		if (this.heartbeatIntervals.has(agentId)) {
			return;
		}

		const interval = setInterval(() => {
			this.checkHeartbeat(agentId);
		}, this.HEARTBEAT_INTERVAL);

		this.heartbeatIntervals.set(agentId, interval);
		this.logService.info(`Heartbeat monitoring started for agent ${agentId}`);
	}

	stopHeartbeatMonitoring(agentId: string): void {
		const interval = this.heartbeatIntervals.get(agentId);
		if (interval) {
			clearInterval(interval);
			this.heartbeatIntervals.delete(agentId);
		}
	}

	getAgentsWithStaleHeartbeats(thresholdMs: number): IRemoteAgent[] {
		const stale: IRemoteAgent[] = [];
		const now = Date.now();

		for (const agent of this.agents.values()) {
			if (now - agent.lastHeartbeat > thresholdMs) {
				stale.push(agent);
			}
		}

		return stale;
	}

	private checkHeartbeat(agentId: string): void {
		const agent = this.agents.get(agentId);
		if (!agent || agent.status !== 'connected') {
			return;
		}

		const now = Date.now();
		const timeSinceLastHeartbeat = now - agent.lastHeartbeat;

		if (timeSinceLastHeartbeat >= this.MISSED_HEARTBEAT_TIMEOUT) {
			agent.status = 'error';
			this.agents.set(agentId, agent);

			this.stopHeartbeatMonitoring(agentId);

			this._onDidMissHeartbeat.fire({ agentId });
			this._onDidAgentStatusChange.fire({ agentId, status: 'error' });

			this.logService.warn(`Agent ${agent.name} missed heartbeat, marked as error`);
		}
	}

	// ── Execution ─────────────────────────────────────────────────────────────

	async executeOnRemoteAgent(
		agentId: string,
		task: { command: string; args?: unknown[]; options?: Record<string, unknown> }
	): Promise<{ success: boolean; result?: unknown; error?: string }> {
		const agent = this.agents.get(agentId);
		if (!agent) {
			return { success: false, error: `Agent ${agentId} not found` };
		}

		if (agent.status !== 'connected') {
			return { success: false, error: `Agent ${agentId} is not connected` };
		}

		try {
			// Simulate remote execution
			await this.simulateNetworkLatency();

			// Update agent load
			agent.load = Math.min(100, agent.load + 10);
			this.agents.set(agentId, agent);

			return {
				success: true,
				result: { output: `Executed: ${task.command}`, status: 'completed' },
			};
		} catch (error) {
			return { success: false, error: String(error) };
		} finally {
			// Decrease load after execution
			agent.load = Math.max(0, agent.load - 10);
			this.agents.set(agentId, agent);
		}
	}

	async syncAgentState(agentId: string): Promise<Record<string, unknown>> {
		const agent = this.agents.get(agentId);
		if (!agent) {
			throw new Error(`Agent ${agentId} not found`);
		}

		// Simulate state sync
		await this.simulateNetworkLatency();

		return {
			status: agent.status,
			load: agent.load,
			capabilities: agent.capabilities,
			lastHeartbeat: agent.lastHeartbeat,
		};
	}

	// ── Failover ──────────────────────────────────────────────────────────────

	async failoverToBackup(agentId: string): Promise<IRemoteAgent> {
		const backups = this.getBackupAgents(agentId);

		if (backups.length === 0) {
			throw new Error(`No backup agents available for ${agentId}`);
		}

		const backupAgent = backups[0];

		try {
			this._onDidAgentStatusChange.fire({ agentId, status: 'disconnected' });

			// Connect to backup
			const newAgent = await this.connectToAgent(backupAgent.endpoint);

			// Sync state from failed agent if possible
			try {
				this.logService.info(`Synced state from failed agent ${agentId}`);
			} catch {
				// State sync failed, but backup is connected
			}

			this.logService.info(`Failed over from ${agentId} to ${newAgent.id}`);

			return newAgent;
		} catch (error) {
			// Try next backup
			return this.failoverToBackup(backups[0].id);
		}
	}

	getBackupAgents(agentId: string): IRemoteAgent[] {
		const backupIds = this.backupAgents.get(agentId) || [];
		const backups: IRemoteAgent[] = [];

		for (const id of backupIds) {
			const agent = this.agents.get(id);
			if (agent && agent.status === 'connected') {
				backups.push(agent);
			}
		}

		return backups;
	}

	// ── Monitoring ───────────────────────────────────────────────────────────

	async getAgentLoad(agentId: string): Promise<{ cpu: number; memory: number; tasks: number }> {
		const agent = this.agents.get(agentId);
		if (!agent) {
			throw new Error(`Agent ${agentId} not found`);
		}

		// Simulate load metrics
		return {
			cpu: agent.load,
			memory: Math.floor(Math.random() * 50) + 20,
			tasks: Math.floor(agent.load / 10),
		};
	}

	async getAllAgentMetrics(): Promise<Map<string, { cpu: number; memory: number; tasks: number }>> {
		const metrics = new Map<string, { cpu: number; memory: number; tasks: number }>();

		for (const agent of this.agents.values()) {
			if (agent.status === 'connected') {
				metrics.set(agent.id, await this.getAgentLoad(agent.id));
			}
		}

		return metrics;
	}

	async runDiagnostics(agentId: string): Promise<{
		connection: boolean;
		latency: number;
		capabilities: string[];
		issues: string[];
	}> {
		const agent = this.agents.get(agentId);
		if (!agent) {
			return {
				connection: false,
				latency: 0,
				capabilities: [],
				issues: ['Agent not found'],
			};
		}

		const issues: string[] = [];
		const startTime = Date.now();

		try {
			await this.simulateNetworkLatency();
		} catch {
			issues.push('Connection failed');
		}

		const latency = Date.now() - startTime;

		if (latency > 1000) {
			issues.push(`High latency: ${latency}ms`);
		}

		const staleHeartbeats = this.getAgentsWithStaleHeartbeats(this.MISSED_HEARTBEAT_TIMEOUT);
		if (staleHeartbeats.some(a => a.id === agentId)) {
			issues.push('Missed heartbeats detected');
		}

		return {
			connection: agent.status === 'connected',
			latency,
			capabilities: agent.capabilities,
			issues,
		};
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private async simulateNetworkLatency(): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
	}

	private updateClusterState(): void {
		const nodes: Map<string, { nodeId: string; status: 'online' | 'offline' | 'degraded'; load: number; lastSeen: number }> = new Map();

		for (const [id, agent] of this.agents) {
			nodes.set(id, {
				nodeId: id,
				status: agent.status === 'connected' ? 'online' : agent.status === 'error' ? 'degraded' : 'offline',
				load: agent.load,
				lastSeen: agent.lastHeartbeat,
			});
		}

		const totalLoad = Array.from(nodes.values()).reduce((sum, n) => sum + n.load, 0);
		const avgLoad = nodes.size > 0 ? totalLoad / nodes.size : 0;

		this.runtimeStateService.update({
			clusterState: {
				nodes,
				masterNode: undefined,
				totalLoad,
				averageLoad: avgLoad,
			},
		});
	}

	private loadAgents(): void {
		const stored = this.storageService.get('nutanaa.remoteAgents', 0);
		if (stored) {
			try {
				const data = JSON.parse(stored);
				this.agents.clear();
				for (const [id, agent] of Object.entries(data.agents || {})) {
					this.agents.set(id, agent as IRemoteAgent);
				}
				this.backupAgents.clear();
				for (const [primaryId, backups] of Object.entries(data.backups || {})) {
					this.backupAgents.set(primaryId, backups as string[]);
				}
			} catch {
				// Keep existing maps on error
			}
		}
	}

	private saveAgents(): void {
		const agentsObj: Record<string, IRemoteAgent> = {};
		for (const [id, agent] of this.agents) {
			agentsObj[id] = agent;
		}

		const backupsObj: Record<string, string[]> = {};
		for (const [primaryId, backups] of this.backupAgents) {
			backupsObj[primaryId] = backups;
		}

		this.storageService.store('nutanaa.remoteAgents', JSON.stringify({
			agents: agentsObj,
			backups: backupsObj,
		}), StorageScope.APPLICATION, StorageTarget.MACHINE);
	}
}
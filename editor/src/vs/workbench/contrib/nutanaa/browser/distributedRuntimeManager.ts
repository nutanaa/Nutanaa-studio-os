/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { INodeInfo, IClusterState } from '../models/enterpriseModel.js';
import { IDistributedRuntimeManager } from '../common/distributedRuntimeManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../common/runtimeEventBus.js';
import { IRuntimeStateService } from '../common/runtimeState.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';

/**
 * DistributedRuntimeManager implementation for Nutanaa Studio OS Enterprise.
 *
 * Manages a cluster of runtime nodes with load balancing,
 * health monitoring, and automatic failover.
 */
export class DistributedRuntimeManager extends Disposable implements IDistributedRuntimeManager {

	declare readonly _serviceBrand: undefined;

	private readonly nodes = new Map<string, INodeInfo>();
	private readonly tasks = new Map<string, {
		status: 'queued' | 'running' | 'completed' | 'failed';
		nodeId: string;
		progress: number;
		result?: unknown;
		error?: string;
	}>();

	private masterNodeId: string | undefined;
	private discoveryInterval: ReturnType<typeof setInterval> | undefined;

	private readonly _onDidNodeJoin = this._register(new Emitter<INodeInfo>());
	private readonly _onDidNodeLeave = this._register(new Emitter<{ nodeId: string; reason: string }>());
	private readonly _onDidNodeStatusChange = this._register(new Emitter<{ nodeId: string; status: INodeInfo['status'] }>());
	private readonly _onDidMasterChange = this._register(new Emitter<{ oldMasterId: string | undefined; newMasterId: string }>());

	public readonly onDidNodeJoin = Event.fromEmitter(this._onDidNodeJoin);
	public readonly onDidNodeLeave = Event.fromEmitter(this._onDidNodeLeave);
	public readonly onDidNodeStatusChange = Event.fromEmitter(this._onDidNodeStatusChange);
	public readonly onDidMasterChange = Event.fromEmitter(this._onDidMasterChange);

	private readonly HEALTH_CHECK_INTERVAL = 10000; // 10 seconds
	private readonly MASTER_TIMEOUT = 30000; // 30 seconds

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.loadClusterState();
		this.initializeLocalNode();
	}

	private initializeLocalNode(): void {
		// Register local node as master
		const localNode: INodeInfo = {
			nodeId: 'local',
			role: 'master',
			address: 'localhost',
			status: 'online',
			capabilities: ['execution', 'storage', 'coordination'],
			load: 0,
			lastSeen: Date.now(),
			version: '1.0.0',
		};

		this.nodes.set(localNode.nodeId, localNode);
		this.masterNodeId = localNode.nodeId;

		this.updateClusterState();
	}

	// ── Cluster Management ────────────────────────────────────────────────────

	getClusterState(): IClusterState {
		const nodesMap = new Map(this.nodes);
		return {
			nodes: nodesMap,
			masterNode: this.masterNodeId,
			totalLoad: this.calculateTotalLoad(),
			averageLoad: this.calculateAverageLoad(),
		};
	}

	getNodes(): INodeInfo[] {
		return Array.from(this.nodes.values());
	}

	getNode(nodeId: string): INodeInfo | undefined {
		return this.nodes.get(nodeId);
	}

	getOnlineNodes(): INodeInfo[] {
		return Array.from(this.nodes.values()).filter(n => n.status === 'online');
	}

	getMasterNode(): INodeInfo | undefined {
		if (!this.masterNodeId) {
			return undefined;
		}
		return this.nodes.get(this.masterNodeId);
	}

	// ── Node Registration ─────────────────────────────────────────────────────

	registerNode(nodeData: Omit<INodeInfo, 'status' | 'lastSeen'>): INodeInfo {
		const node: INodeInfo = {
			...nodeData,
			status: 'online',
			lastSeen: Date.now(),
		};

		this.nodes.set(node.nodeId, node);

		// If this is the first worker/edge node and no master, it can't be master
		if (node.role !== 'master') {
			this.updateClusterState();
		}

		// Fire events
		this._onDidNodeJoin.fire(node);

		this.runtimeEventBus.fire({
			type: RuntimeEventType.NodeConnected,
			timestamp: Date.now(),
			payload: {
				nodeId: node.nodeId,
				endpoint: node.address,
				capabilities: node.capabilities,
			},
		});

		this.logService.info(`Node ${node.nodeId} (${node.role}) joined the cluster`);

		return node;
	}

	unregisterNode(nodeId: string): void {
		const node = this.nodes.get(nodeId);
		if (!node) {
			return;
		}

		this.nodes.delete(nodeId);

		// If master left, elect new master
		if (nodeId === this.masterNodeId) {
			this.masterNodeId = undefined;
			this.electMaster().catch(() => {});
		}

		this.updateClusterState();

		// Fire events
		this._onDidNodeLeave.fire({ nodeId, reason: 'unregister' });

		this.logService.info(`Node ${nodeId} left the cluster`);
	}

	updateNodeStatus(nodeId: string, status: 'online' | 'offline' | 'degraded'): void {
		const node = this.nodes.get(nodeId);
		if (!node) {
			return;
		}

		const oldStatus = node.status;
		node.status = status;
		node.lastSeen = Date.now();
		this.nodes.set(nodeId, node);

		this._onDidNodeStatusChange.fire({ nodeId, status });

		// If master goes offline, trigger failover
		if (nodeId === this.masterNodeId && status !== 'online') {
			this.electMaster().catch(() => {});
		}

		this.updateClusterState();
		this.logService.info(`Node ${nodeId} status changed: ${oldStatus} -> ${status}`);
	}

	// ── Discovery ────────────────────────────────────────────────────────────

	startDiscovery(): void {
		if (this.discoveryInterval) {
			return;
		}

		// Periodic health checks
		this.discoveryInterval = setInterval(() => {
			this.runAllHealthChecks();
		}, this.HEALTH_CHECK_INTERVAL);

		this.logService.info('Node discovery started');
	}

	stopDiscovery(): void {
		if (this.discoveryInterval) {
			clearInterval(this.discoveryInterval);
			this.discoveryInterval = undefined;
		}

		this.logService.info('Node discovery stopped');
	}

	async addNode(address: string, role: 'master' | 'worker' | 'edge'): Promise<INodeInfo> {
		const nodeId = `node-${Date.now()}-${Math.random().toString(36).slice(2)}`;

		const node = this.registerNode({
			nodeId,
			role,
			address,
			capabilities: role === 'master'
				? ['execution', 'storage', 'coordination']
				: role === 'worker'
					? ['execution', 'storage']
					: ['execution'],
			load: 0,
			version: '1.0.0',
		});

		return node;
	}

	removeNode(nodeId: string): void {
		this.unregisterNode(nodeId);
	}

	// ── Load Balancing ───────────────────────────────────────────────────────

	getBestNodeForTask(taskType: string): INodeInfo | undefined {
		const onlineNodes = this.getOnlineNodes().filter(n => {
			// Filter by capability
			if (taskType && !n.capabilities.includes(taskType)) {
				return false;
			}
			return n.load < 80; // Max load threshold
		});

		if (onlineNodes.length === 0) {
			return undefined;
		}

		// Return node with lowest load
		return onlineNodes.sort((a, b) => a.load - b.load)[0];
	}

	async routeTask(task: {
		type: string;
		priority?: number;
		requirements?: Record<string, unknown>;
	}): Promise<INodeInfo> {
		// Find best node
		let node = task.targetNodeId
			? this.nodes.get(task.targetNodeId)
			: this.getBestNodeForTask(task.type);

		// If no specific node, use master
		if (!node && this.masterNodeId) {
			node = this.nodes.get(this.masterNodeId);
		}

		if (!node) {
			throw new Error('No suitable node available');
		}

		// Increase node load
		node.load = Math.min(100, node.load + (task.priority || 1) * 5);
		this.nodes.set(node.nodeId, node);

		this.updateClusterState();

		return node;
	}

	getLoadStatistics(): {
		totalLoad: number;
		averageLoad: number;
		maxLoad: number;
		minLoad: number;
		nodeCount: number;
		onlineNodeCount: number;
	} {
		const nodes = Array.from(this.nodes.values());
		const onlineNodes = nodes.filter(n => n.status === 'online');

		const loads = nodes.map(n => n.load);
		const totalLoad = loads.reduce((a, b) => a + b, 0);

		return {
			totalLoad,
			averageLoad: nodes.length > 0 ? totalLoad / nodes.length : 0,
			maxLoad: Math.max(...loads, 0),
			minLoad: Math.min(...loads, 0),
			nodeCount: nodes.length,
			onlineNodeCount: onlineNodes.length,
		};
	}

	// ── Health Monitoring ─────────────────────────────────────────────────────

	getHealthStatus(): Map<string, {
		status: 'healthy' | 'degraded' | 'unhealthy';
		latency: number;
		errorRate: number;
		issues: string[];
	}> {
		const status = new Map<string, {
			status: 'healthy' | 'degraded' | 'unhealthy';
			latency: number;
			errorRate: number;
			issues: string[];
		}>();

		for (const node of this.nodes.values()) {
			const issues: string[] = [];

			if (node.status !== 'online') {
				issues.push(`Node status: ${node.status}`);
			}

			if (node.load > 80) {
				issues.push(`High load: ${node.load}%`);
			}

			const statusValue: 'healthy' | 'degraded' | 'unhealthy' =
				node.status === 'online' && node.load < 80 ? 'healthy' :
					node.status === 'degraded' || node.load > 80 ? 'degraded' : 'unhealthy';

			status.set(node.nodeId, {
				status: statusValue,
				latency: Math.floor(Math.random() * 50) + 10,
				errorRate: statusValue === 'unhealthy' ? 0.1 : 0.01,
				issues,
			});
		}

		return status;
	}

	async runHealthCheck(nodeId: string): Promise<{
		status: 'healthy' | 'degraded' | 'unhealthy';
		latency: number;
		issues: string[];
	}> {
		const node = this.nodes.get(nodeId);
		if (!node) {
			return { status: 'unhealthy', latency: 0, issues: ['Node not found'] };
		}

		const issues: string[] = [];
		const startTime = Date.now();

		// Simulate health check
		await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

		const latency = Date.now() - startTime;

		if (node.status !== 'online') {
			issues.push(`Node status: ${node.status}`);
		}

		if (node.load > 90) {
			issues.push(`Critical load: ${node.load}%`);
		}

		const status: 'healthy' | 'degraded' | 'unhealthy' =
			node.status === 'online' && node.load < 70 ? 'healthy' :
				node.status === 'degraded' || node.load > 70 ? 'degraded' : 'unhealthy';

		return { status, latency, issues };
	}

	// ── Failover ──────────────────────────────────────────────────────────────

	async triggerFailover(): Promise<INodeInfo> {
		this.logService.info('Triggering master failover');

		const newMaster = await this.electMaster();
		if (!newMaster) {
			throw new Error('No suitable node for master election');
		}

		return newMaster;
	}

	async electMaster(): Promise<INodeInfo | undefined> {
		const onlineNodes = this.getOnlineNodes().filter(n => n.role === 'master' || n.role === 'worker');

		if (onlineNodes.length === 0) {
			this.logService.warn('No nodes available for master election');
			return undefined;
		}

		// Sort by role priority, then load
		const candidates = onlineNodes.sort((a, b) => {
			const rolePriority = { master: 0, worker: 1, edge: 2 };
			const roleDiff = rolePriority[a.role] - rolePriority[b.role];
			if (roleDiff !== 0) return roleDiff;
			return a.load - b.load;
		});

		const newMaster = candidates[0];
		const oldMaster = this.masterNodeId;

		if (newMaster.nodeId === oldMaster) {
			return newMaster;
		}

		const previousMasterId = this.masterNodeId;
		this.masterNodeId = newMaster.nodeId;

		// Update node status
		newMaster.load = Math.min(100, newMaster.load + 10);
		this.nodes.set(newMaster.nodeId, newMaster);

		this.updateClusterState();

		// Fire events
		this._onDidMasterChange.fire({
			oldMasterId: previousMasterId,
			newMasterId: newMaster.nodeId,
		});

		this.logService.info(`Master elected: ${newMaster.nodeId}`);

		return newMaster;
	}

	isFailoverNeeded(): boolean {
		if (!this.masterNodeId) {
			return true;
		}

		const master = this.nodes.get(this.masterNodeId);
		if (!master || master.status !== 'online') {
			return true;
		}

		return master.load > 90;
	}

	// ── invoke_sub_agent Routing ──────────────────────────────────────────────────────────

	async submitTask(task: {
		type: string;
		payload: unknown;
		priority?: number;
		targetNodeId?: string;
	}): Promise<string> {
		const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;

		// Route task to node
		const node = await this.routeTask(task);

		// Track task
		this.tasks.set(taskId, {
			status: 'queued',
			nodeId: node.nodeId,
			progress: 0,
		});

		// Simulate task completion
		this.simulateTaskCompletion(taskId);

		this.logService.info(`Task ${taskId} submitted to node ${node.nodeId}`);

		return taskId;
	}

	getTaskStatus(taskId: string): {
		status: 'queued' | 'running' | 'completed' | 'failed';
		nodeId: string;
		progress: number;
		result?: unknown;
		error?: string;
	} | undefined {
		return this.tasks.get(taskId);
	}

	private simulateTaskCompletion(taskId: string): void {
		const task = this.tasks.get(taskId);
		if (!task) return;

		task.status = 'running';

		// Simulate progress
		const progressInterval = setInterval(() => {
			task.progress = Math.min(100, task.progress + 10);

			if (task.progress >= 100) {
				clearInterval(progressInterval);
				task.status = 'completed';
				task.result = { success: true };

				// Decrease node load
				const node = this.nodes.get(task.nodeId);
				if (node) {
					node.load = Math.max(0, node.load - 5);
					this.nodes.set(task.nodeId, node);
					this.updateClusterState();
				}
			}
		}, 500);
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private calculateTotalLoad(): number {
		return Array.from(this.nodes.values()).reduce((sum, n) => sum + n.load, 0);
	}

	private calculateAverageLoad(): number {
		const nodes = Array.from(this.nodes.values());
		if (nodes.length === 0) return 0;
		return this.calculateTotalLoad() / nodes.length;
	}

	private async runAllHealthChecks(): Promise<void> {
		for (const node of this.nodes.values()) {
			if (node.status === 'online') {
				const health = await this.runHealthCheck(node.nodeId);

				if (health.status === 'unhealthy') {
					this.updateNodeStatus(node.nodeId, 'degraded');
				} else if (health.issues.length > 0 && node.status === 'online') {
					this.updateNodeStatus(node.nodeId, 'degraded');
				}
			}
		}
	}

	private updateClusterState(): void {
		const clusterState = this.getClusterState();
		const nodes: Map<string, { nodeId: string; status: 'online' | 'offline' | 'degraded'; load: number; lastSeen: number }> = new Map();

		for (const [id, node] of this.nodes) {
			nodes.set(id, {
				nodeId: id,
				status: node.status,
				load: node.load,
				lastSeen: node.lastSeen,
			});
		}

		this.runtimeStateService.update({
			clusterState: {
				nodes,
				masterNode: this.masterNodeId,
				totalLoad: clusterState.totalLoad,
				averageLoad: clusterState.averageLoad,
			},
		});
	}

	private loadClusterState(): void {
		const stored = this.storageService.get('nutanaa.cluster', 0);
		if (stored) {
			try {
				const data = JSON.parse(stored);
				for (const [id, node] of Object.entries(data.nodes || {})) {
					this.nodes.set(id, node);
				}
				this.masterNodeId = data.masterNodeId;
			} catch {
				this.nodes = new Map();
				this.masterNodeId = undefined;
			}
		}
	}

	private saveClusterState(): void {
		const nodesObj: Record<string, INodeInfo> = {};
		for (const [id, node] of this.nodes) {
			nodesObj[id] = node;
		}

		this.storageService.store('nutanaa.cluster', JSON.stringify({
			nodes: nodesObj,
			masterNodeId: this.masterNodeId,
		}), 0);
	}
}
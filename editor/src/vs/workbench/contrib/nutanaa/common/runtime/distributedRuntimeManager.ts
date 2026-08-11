/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { INodeInfo, IClusterState } from '../../models/enterpriseModel.js';

/**
 * Service for managing the distributed runtime cluster in Nutanaa Studio OS Enterprise.
 *
 * Responsibilities:
 * - Multiple runtime node management
 * - Node discovery and registration
 * - Load balancing and task routing
 * - Health monitoring and failover
 * - Cluster state synchronization
 */
export const IDistributedRuntimeManager = createDecorator<IDistributedRuntimeManager>('nutanaaDistributedRuntimeManager');

export interface IDistributedRuntimeManager {

	// ── Cluster Management ────────────────────────────────────────────────────

	/**
	 * Get current cluster state.
	 * @returns Current cluster state
	 */
	getClusterState(): IClusterState;

	/**
	 * Get all nodes in the cluster.
	 * @returns Array of node information
	 */
	getNodes(): INodeInfo[];

	/**
	 * Get node by ID.
	 * @param nodeId The node ID
	 * @returns Node info or undefined
	 */
	getNode(nodeId: string): INodeInfo | undefined;

	/**
	 * Get online nodes.
	 * @returns Array of online nodes
	 */
	getOnlineNodes(): INodeInfo[];

	/**
	 * Get master node.
	 * @returns Master node info or undefined
	 */
	getMasterNode(): INodeInfo | undefined;

	// ── Node Registration ─────────────────────────────────────────────────────

	/**
	 * Register a new node.
	 * @param node The node to register
	 * @returns Registered node
	 */
	registerNode(node: Omit<INodeInfo, 'status' | 'lastSeen'>): INodeInfo;

	/**
	 * Unregister a node.
	 * @param nodeId The node ID
	 */
	unregisterNode(nodeId: string): void;

	/**
	 * Update node status.
	 * @param nodeId The node ID
	 * @param status The new status
	 */
	updateNodeStatus(nodeId: string, status: 'online' | 'offline' | 'degraded'): void;

	// ── Discovery ────────────────────────────────────────────────────────────

	/**
	 * Start node discovery.
	 */
	startDiscovery(): void;

	/**
	 * Stop node discovery.
	 */
	stopDiscovery(): void;

	/**
	 * Manually add a node.
	 * @param address The node address
	 * @param role The node role
	 * @returns Added node
	 */
	addNode(address: string, role: 'master' | 'worker' | 'edge'): Promise<INodeInfo>;

	/**
	 * Remove a node.
	 * @param nodeId The node ID
	 */
	removeNode(nodeId: string): void;

	// ── Load Balancing ───────────────────────────────────────────────────────

	/**
	 * Get the best node for a task.
	 * @param taskType The task type
	 * @returns Best node for the task
	 */
	getBestNodeForTask(taskType: string): INodeInfo | undefined;

	/**
	 * Route a task to a node.
	 * @param task The task definition
	 * @returns Selected node
	 */
	routeTask(task: { type: string; priority?: number; requirements?: Record<string, unknown> }): Promise<INodeInfo>;

	/**
	 * Get cluster load statistics.
	 * @returns Load statistics
	 */
	getLoadStatistics(): {
		totalLoad: number;
		averageLoad: number;
		maxLoad: number;
		minLoad: number;
		nodeCount: number;
		onlineNodeCount: number;
	};

	// ── Health Monitoring ─────────────────────────────────────────────────────

	/**
	 * Get health status for all nodes.
	 * @returns Map of node ID to health status
	 */
	getHealthStatus(): Map<string, {
		status: 'healthy' | 'degraded' | 'unhealthy';
		latency: number;
		errorRate: number;
		issues: string[];
	}>;

	/**
	 * Run health check on a node.
	 * @param nodeId The node ID
	 * @returns Health check result
	 */
	runHealthCheck(nodeId: string): Promise<{
		status: 'healthy' | 'degraded' | 'unhealthy';
		latency: number;
		issues: string[];
	}>;

	// ── Failover ──────────────────────────────────────────────────────────────

	/**
	 * Trigger failover to a new master.
	 * @returns New master node
	 */
	triggerFailover(): Promise<INodeInfo>;

	/**
	 * Elect a new master from available nodes.
	 * @returns Elected node
	 */
	electMaster(): Promise<INodeInfo | undefined>;

	/**
	 * Check if failover is needed.
	 * @returns True if failover is needed
	 */
	isFailoverNeeded(): boolean;

	// ── Task Routing ──────────────────────────────────────────────────────────

	/**
	 * Submit a task to the cluster.
	 * @param task The task definition
	 * @returns Task ID
	 */
	submitTask(task: {
		type: string;
		payload: unknown;
		priority?: number;
		targetNodeId?: string;
	}): Promise<string>;

	/**
	 * Get task status.
	 * @param taskId The task ID
	 * @returns Task status
	 */
	getTaskStatus(taskId: string): {
		status: 'queued' | 'running' | 'completed' | 'failed';
		nodeId: string;
		progress: number;
		result?: unknown;
		error?: string;
	} | undefined;

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when a node joins.
	 */
	onDidNodeJoin: (listener: (node: INodeInfo) => void) => { dispose(): void };

	/**
	 * Event fired when a node leaves.
	 */
	onDidNodeLeave: (listener: (nodeId: string, reason: string) => void) => { dispose(): void };

	/**
	 * Event fired when node status changes.
	 */
	onDidNodeStatusChange: (listener: (nodeId: string, status: INodeInfo['status']) => void) => { dispose(): void };

	/**
	 * Event fired when master changes.
	 */
	onDidMasterChange: (listener: (oldMasterId: string | undefined, newMasterId: string) => void) => { dispose(): void };
}
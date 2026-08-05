/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../base/common/event.js';
import { ILogService } from '../../../../platform/log/common/log.js';

import { IRuntimeCoordinator } from '../common/runtimeCoordinator.js';
import { IRuntimeEventBus } from '../common/runtimeEventBus.js';
import { IAgentCoordinator } from '../common/agentCoordinator.js';
import { ITaskScheduler } from '../common/taskScheduler.js';
import { IWorkflowEngine } from '../common/workflowEngine.js';
import { IAgentDispatcher } from '../services/agentDispatcher.js';
import { IRuntimeEvent } from '../common/runtimeEvent.js';
import {
	IAgentExecutionRequest,
	IWorkflowExecutionRequest,
	ITaskDefinition,
} from '../models/executionModel.js';

/*---------------------------------------------------------------------------------------------
 * RuntimeCoordinator
 *--------------------------------------------------------------------------------------------*/

/**
 * RuntimeCoordinator is an orchestrator — it holds references to every
 * Phase 2 execution service and provides a single entry point for the
 * workbench to trigger agent, task, and workflow execution.
 *
 * It contains NO business logic. It only routes requests to the correct
 * service and forwards lifecycle events from the bus to VS Code's log service.
 *
 * Dependency graph (coordinator → services; no cycles):
 *
 *   RuntimeCoordinator
 *     ├─ IAgentCoordinator   (lifecycle + dispatch coordination)
 *     ├─ ITaskScheduler      (priority queue + concurrency)
 *     ├─ IWorkflowEngine     (graph execution)
 *     └─ IRuntimeEventBus    (observe all events for logging)
 */
export class RuntimeCoordinator extends Disposable implements IRuntimeCoordinator {

	declare readonly _serviceBrand: undefined;

	private readonly _onRuntimeReady = this._register(new Emitter<void>());
	readonly onRuntimeReady = this._onRuntimeReady.event;

	constructor(
		@IRuntimeEventBus private readonly eventBus: IRuntimeEventBus,
		@IAgentCoordinator private readonly agentCoordinator: IAgentCoordinator,
		@ITaskScheduler private readonly taskScheduler: ITaskScheduler,
		@IWorkflowEngine private readonly workflowEngine: IWorkflowEngine,
		@IAgentDispatcher private readonly agentDispatcher: IAgentDispatcher,
		@ILogService private readonly logService: ILogService,
	) {
		super();

		// Wire the dispatcher into the agent coordinator now that both services
		// exist. This breaks the AgentCoordinator → AgentDispatcher → AgentCoordinator
		// circular dependency at the DI level by using a post-construction setter.
		this.agentCoordinator.setDispatcher(
			(req: IAgentExecutionRequest) => this.agentDispatcher.dispatch(req)
		);

		// Observe all bus events for structured logging (replaces console.log).
		this._register(this.eventBus.onEvent(e => this.handleRuntimeEvent(e)));
	}

	/*-------------------------------------------------------------------------------------------
	 * IRuntimeCoordinator — lifecycle
	 *------------------------------------------------------------------------------------------*/

	public async start(): Promise<void> {
		this.logService.info('[RuntimeCoordinator] started.');
		this._onRuntimeReady.fire();
	}

	public async stop(): Promise<void> {
		this.logService.info('[RuntimeCoordinator] stopped.');
	}

	public handleRuntimeEvent(event: IRuntimeEvent): void {
		this.logService.trace(
			`[RuntimeCoordinator] event type=${event.type} ts=${event.timestamp}`
		);
	}

	/*-------------------------------------------------------------------------------------------
	 * Execution routing — called by workbench commands / chat / panels
	 *------------------------------------------------------------------------------------------*/

	/**
	 * Execute an agent request through the AgentCoordinator.
	 * This is the entry point for ad-hoc agent calls from the workbench.
	 */
	public executeAgent(request: IAgentExecutionRequest) {
		return this.agentCoordinator.executeAgent(request);
	}

	/**
	 * Submit a task to the TaskScheduler.
	 * Used when the caller needs priority queuing, retry, and concurrency control.
	 */
	public scheduleTask(definition: ITaskDefinition) {
		return this.taskScheduler.submit(definition);
	}

	/**
	 * Execute a workflow graph through the WorkflowEngine.
	 */
	public executeWorkflow(request: IWorkflowExecutionRequest) {
		return this.workflowEngine.executeWorkflow(request);
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IAgentState, IAgentPermissionRequest } from '../../models/agentModel.js';
import { IAgentStepExecution, IAgentExecutionResult } from '../../models/agentExecutionModel.js';

export class AgentEventBus extends Disposable {
	private readonly _onAgentStatusChanged = this._register(new Emitter<IAgentState>());
	readonly onAgentStatusChanged: Event<IAgentState> = this._onAgentStatusChanged.event;

	private readonly _onAgentStepStarted = this._register(new Emitter<{ agentId: string; step: IAgentStepExecution }>());
	readonly onAgentStepStarted: Event<{ agentId: string; step: IAgentStepExecution }> = this._onAgentStepStarted.event;

	private readonly _onAgentStepCompleted = this._register(new Emitter<{ agentId: string; step: IAgentStepExecution }>());
	readonly onAgentStepCompleted: Event<{ agentId: string; step: IAgentStepExecution }> = this._onAgentStepCompleted.event;

	private readonly _onAgentExecutionFinished = this._register(new Emitter<IAgentExecutionResult>());
	readonly onAgentExecutionFinished: Event<IAgentExecutionResult> = this._onAgentExecutionFinished.event;

	private readonly _onPermissionRequested = this._register(new Emitter<IAgentPermissionRequest>());
	readonly onPermissionRequested: Event<IAgentPermissionRequest> = this._onPermissionRequested.event;

	private readonly _onLogMessage = this._register(new Emitter<{ agentId: string; level: 'info' | 'warn' | 'error'; message: string; timestamp: number }>());
	readonly onLogMessage = this._onLogMessage.event;

	public emitStatusChange(state: IAgentState): void {
		this._onAgentStatusChanged.fire(state);
	}

	public emitStepStarted(agentId: string, step: IAgentStepExecution): void {
		this._onAgentStepStarted.fire({ agentId, step });
	}

	public emitStepCompleted(agentId: string, step: IAgentStepExecution): void {
		this._onAgentStepCompleted.fire({ agentId, step });
	}

	public emitExecutionFinished(result: IAgentExecutionResult): void {
		this._onAgentExecutionFinished.fire(result);
	}

	public emitPermissionRequest(request: IAgentPermissionRequest): void {
		this._onPermissionRequested.fire(request);
	}

	public emitLog(agentId: string, level: 'info' | 'warn' | 'error', message: string): void {
		this._onLogMessage.fire({ agentId, level, message, timestamp: Date.now() });
	}
}

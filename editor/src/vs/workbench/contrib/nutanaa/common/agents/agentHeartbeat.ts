/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { IAgentStateService } from './agentStateService.js';

export class AgentHeartbeatMonitor extends Disposable {
	private readonly intervalMs = 5000;
	private readonly timeoutMs = 15000;
	private timerHandle?: ReturnType<typeof setInterval>;

	private readonly _onAgentStalled = this._register(new Emitter<string>());
	readonly onAgentStalled: Event<string> = this._onAgentStalled.event;

	constructor(
		@IAgentStateService private readonly stateService: IAgentStateService
	) {
		super();
		this.startMonitoring();
	}

	public startMonitoring(): void {
		if (this.timerHandle) {
			return;
		}
		this.timerHandle = setInterval(() => this.checkHeartbeats(), this.intervalMs);
	}

	public recordHeartbeat(agentId: string): void {
		try {
			this.stateService.updateAgentState(agentId, { lastHeartbeat: Date.now() });
		} catch {
			// Agent unmapped or terminated
		}
	}

	private checkHeartbeats(): void {
		const now = Date.now();
		const states = this.stateService.getAllAgentStates();
		for (const state of states) {
			if (state.status === 'running') {
				if (now - state.lastHeartbeat > this.timeoutMs) {
					this._onAgentStalled.fire(state.id);
				}
			}
		}
	}

	public override dispose(): void {
		if (this.timerHandle) {
			clearInterval(this.timerHandle);
			this.timerHandle = undefined;
		}
		super.dispose();
	}
}

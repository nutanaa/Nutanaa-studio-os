/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IAgentState, IAgentConfiguration, AgentPriority } from '../models/agentModel.js';

export const IAgentStateService = createDecorator<IAgentStateService>('agentStateService');

export interface IAgentStateService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeAgentState: Event<IAgentState>;
	registerAgent(config: IAgentConfiguration, priority?: AgentPriority): IAgentState;
	unregisterAgent(agentId: string): void;
	getAgentState(agentId: string): IAgentState | undefined;
	getAllAgentStates(): IAgentState[];
	updateAgentState(agentId: string, patch: Partial<IAgentState>): IAgentState;
}

export class AgentStateService extends Disposable implements IAgentStateService {
	declare readonly _serviceBrand: undefined;

	private readonly states = new Map<string, IAgentState>();
	private readonly _onDidChangeAgentState = this._register(new Emitter<IAgentState>());
	readonly onDidChangeAgentState = this._onDidChangeAgentState.event;

	public registerAgent(config: IAgentConfiguration, priority: AgentPriority = 'normal'): IAgentState {
		const now = Date.now();
		const state: IAgentState = {
			id: config.id,
			config,
			status: 'idle',
			priority,
			progress: 0,
			createdAt: now,
			lastHeartbeat: now,
			retryCount: 0,
			totalCostUsd: 0,
			totalTokensUsed: 0
		};
		this.states.set(config.id, state);
		this._onDidChangeAgentState.fire(state);
		return state;
	}

	public unregisterAgent(agentId: string): void {
		const state = this.states.get(agentId);
		if (state) {
			this.states.delete(agentId);
		}
	}

	public getAgentState(agentId: string): IAgentState | undefined {
		return this.states.get(agentId);
	}

	public getAllAgentStates(): IAgentState[] {
		return Array.from(this.states.values());
	}

	public updateAgentState(agentId: string, patch: Partial<IAgentState>): IAgentState {
		const current = this.states.get(agentId);
		if (!current) {
			throw new Error(`Agent not found: ${agentId}`);
		}
		const updated: IAgentState = { ...current, ...patch };
		this.states.set(agentId, updated);
		this._onDidChangeAgentState.fire(updated);
		return updated;
	}
}

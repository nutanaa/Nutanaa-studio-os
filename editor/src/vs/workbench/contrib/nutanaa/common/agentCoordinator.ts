/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const IAgentCoordinator = createDecorator<IAgentCoordinator>('agentCoordinator');

export interface AgentInfo {

	readonly id: string;

	readonly name: string;

	readonly provider: string;

	status: 'idle' | 'queued' | 'running' | 'completed' | 'failed';

}

export interface IAgentCoordinator {

	readonly _serviceBrand: undefined;

	readonly onAgentsChanged: Event<readonly AgentInfo[]>;

	registerAgent(agent: AgentInfo): void;

	unregisterAgent(id: string): void;

	updateStatus(id: string, status: AgentInfo['status']): void;

	getAgents(): readonly AgentInfo[];

	getAgent(id: string): AgentInfo | undefined;

}

export class AgentCoordinator extends Disposable implements IAgentCoordinator {

	declare readonly _serviceBrand: undefined;

	private readonly agents = new Map<string, AgentInfo>();

	private readonly _onAgentsChanged = this._register(
		new Emitter<readonly AgentInfo[]>()
	);

	public readonly onAgentsChanged = this._onAgentsChanged.event;

	registerAgent(agent: AgentInfo): void {

		this.agents.set(agent.id, agent);

		this.publish();

	}

	unregisterAgent(id: string): void {

		this.agents.delete(id);

		this.publish();

	}

	updateStatus(id: string, status: AgentInfo['status']): void {

		const agent = this.agents.get(id);

		if (!agent) {
			return;
		}

		agent.status = status;

		this.publish();

	}

	getAgents(): readonly AgentInfo[] {

		return [...this.agents.values()];

	}

	getAgent(id: string): AgentInfo | undefined {

		return this.agents.get(id);

	}

	private publish(): void {

		this._onAgentsChanged.fire(this.getAgents());

	}

}
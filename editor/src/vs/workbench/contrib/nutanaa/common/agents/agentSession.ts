/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';

export class AgentSession extends Disposable {
	readonly sessionId: string;
	readonly agentId: string;
	readonly startTime: number;
	private activeContext: Record<string, unknown> = {};

	constructor(agentId: string) {
		super();
		this.agentId = agentId;
		this.sessionId = `session_${agentId}_${Date.now()}`;
		this.startTime = Date.now();
	}

	public setContext(key: string, value: unknown): void {
		this.activeContext[key] = value;
	}

	public getContext(key: string): unknown {
		return this.activeContext[key];
	}

	public getAllContext(): Record<string, unknown> {
		return { ...this.activeContext };
	}
}

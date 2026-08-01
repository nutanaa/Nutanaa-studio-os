// File: src/vs/workbench/contrib/nutanaa/common/agentSession.ts

import { Disposable } from '../../../../base/common/lifecycle.js';

export class AgentSession extends Disposable {
	readonly sessionId: string;
	readonly agentId: string;
	readonly startTime: number;
	private activeContext: Record<string, any> = {};

	constructor(agentId: string) {
		super();
		this.agentId = agentId;
		this.sessionId = `session_${agentId}_${Date.now()}`;
		this.startTime = Date.now();
	}

	public setContext(key: string, value: any): void {
		this.activeContext[key] = value;
	}

	public getContext(key: string): any {
		return this.activeContext[key];
	}

	public getAllContext(): Record<string, any> {
		return { ...this.activeContext };
	}
}
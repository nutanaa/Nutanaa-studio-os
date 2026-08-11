/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';

export interface IDebugFrame {
	readonly frameId: string;
	readonly agentId: string;
	readonly stepName: string;
	readonly variables: Record<string, unknown>;
	readonly timestamp: number;
}

export class AgentDebugger extends Disposable {
	private readonly frames: IDebugFrame[] = [];
	private isPausedAtBreakpoint = false;

	public pushFrame(agentId: string, stepName: string, variables: Record<string, unknown>): IDebugFrame {
		const frame: IDebugFrame = {
			frameId: `frame_${Date.now()}`,
			agentId,
			stepName,
			variables: { ...variables },
			timestamp: Date.now()
		};
		this.frames.push(frame);
		return frame;
	}

	public pause(): void {
		this.isPausedAtBreakpoint = true;
	}

	public resume(): void {
		this.isPausedAtBreakpoint = false;
	}

	public isPaused(): boolean {
		return this.isPausedAtBreakpoint;
	}

	public getFrames(): IDebugFrame[] {
		return [...this.frames];
	}
}

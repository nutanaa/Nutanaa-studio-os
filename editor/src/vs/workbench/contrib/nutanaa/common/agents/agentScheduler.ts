/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { AgentQueue } from './agentQueue.js';
import { IAgentQueueItem } from '../../models/agentQueueModel.js';

export class AgentScheduler extends Disposable {
	private timerHandle?: ReturnType<typeof setInterval>;

	constructor(private readonly queue: AgentQueue, private readonly onExecute: (item: IAgentQueueItem) => Promise<void>) {
		super();
	}

	public start(intervalMs: number = 500): void {
		if (this.timerHandle) {
			return;
		}
		this.timerHandle = setInterval(() => this.tick(), intervalMs);
	}

	public stop(): void {
		if (this.timerHandle) {
			clearInterval(this.timerHandle);
			this.timerHandle = undefined;
		}
	}

	private async tick(): Promise<void> {
		const item = this.queue.dequeue();
		if (!item) {
			return;
		}

		try {
			await this.onExecute(item);
		} finally {
			this.queue.markFinished(item.queueId);
		}
	}

	public override dispose(): void {
		this.stop();
		super.dispose();
	}
}

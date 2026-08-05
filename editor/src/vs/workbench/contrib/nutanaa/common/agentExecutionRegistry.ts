/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IAgentExecutionResult } from '../models/agentExecutionModel.js';

export const IAgentExecutionRegistry =
	createDecorator<IAgentExecutionRegistry>('agentExecutionRegistry');

export interface IExecutionRecord {

	id: string;

	agentId: string;

	startTime: number;

	endTime?: number;

	status: 'queued' | 'running' | 'completed' | 'failed';

	result?: IAgentExecutionResult;

	error?: unknown;

}

export interface IAgentExecutionRegistry {

	readonly _serviceBrand: undefined;

	readonly onDidChange: Event<IExecutionRecord>;

	start(record: IExecutionRecord): void;

	complete(id: string, result: IAgentExecutionResult): void;

	fail(id: string, error: unknown): void;

	get(id: string): IExecutionRecord | undefined;

	getAll(): readonly IExecutionRecord[];

}

export class AgentExecutionRegistry extends Disposable implements IAgentExecutionRegistry {

	declare readonly _serviceBrand: undefined;

	private readonly records = new Map<string, IExecutionRecord>();

	private readonly emitter = this._register(new Emitter<IExecutionRecord>());

	readonly onDidChange = this.emitter.event;

	start(record: IExecutionRecord): void {

		this.records.set(record.id, record);

		this.emitter.fire(record);

	}

	complete(id: string, result: IAgentExecutionResult): void {

		const record = this.records.get(id);

		if (!record) {
			return;
		}

		record.status = 'completed';

		record.endTime = Date.now();

		record.result = result;

		this.emitter.fire(record);

	}

	fail(id: string, error: unknown): void {

		const record = this.records.get(id);

		if (!record) {
			return;
		}

		record.status = 'failed';

		record.endTime = Date.now();

		record.error = error;

		this.emitter.fire(record);

	}

	get(id: string): IExecutionRecord | undefined {

		return this.records.get(id);

	}

	getAll(): readonly IExecutionRecord[] {

		return [...this.records.values()];

	}
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';

export const IAgentTelemetryService = createDecorator<IAgentTelemetryService>('agentTelemetryService');

export interface IAgentTelemetryService {
	readonly _serviceBrand: undefined;
	logAgentEvent(eventName: string, data: Record<string, unknown>): void;
}

export class AgentTelemetryService extends Disposable implements IAgentTelemetryService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@ITelemetryService private readonly telemetryService: ITelemetryService
	) {
		super();
	}

	public logAgentEvent(eventName: string, data: Record<string, unknown>): void {
		this.telemetryService.publicLog(`nutanaa.agent.${eventName}`, data);
	}
}

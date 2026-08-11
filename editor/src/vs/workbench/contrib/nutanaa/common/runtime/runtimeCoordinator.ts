/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../../base/common/event.js';
import { IRuntimeEvent } from './runtimeEvent.js';
import { IAgentExecutionRequest, IAgentExecutionResponse } from '../../models/executionModel.js';

export const IRuntimeCoordinator =
	createDecorator<IRuntimeCoordinator>('runtimeCoordinator');

export interface IRuntimeCoordinator {

	readonly _serviceBrand: undefined;

	readonly onRuntimeReady: Event<void>;

	start(): Promise<void>;

	stop(): Promise<void>;

	handleRuntimeEvent(event: IRuntimeEvent): void;

	executeAgent(request: IAgentExecutionRequest): Promise<IAgentExecutionResponse>;
}
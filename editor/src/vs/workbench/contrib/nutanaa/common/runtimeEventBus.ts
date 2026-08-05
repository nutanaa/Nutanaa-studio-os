/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

import {
	RuntimeEvent
} from './runtimeEvents.js';

export const IRuntimeEventBus = createDecorator<IRuntimeEventBus>('runtimeEventBus');

/**
 * Global Runtime Event Bus.
 *
 * Every Nutanaa subsystem communicates through this bus.
 *
 * RuntimeConnectionService
 * AgentCoordinator
 * ProviderManager
 * WorkflowManager
 * MemoryManager
 * LogManager
 * UI Views
 *
 * publish and subscribe here.
 *
 * Services should NEVER reference each other directly.
 */

export interface IRuntimeEventBus {

	readonly _serviceBrand: undefined;

	/**
	 * Fired whenever any runtime event occurs.
	 */
	readonly onEvent: Event<RuntimeEvent>;

	/**
	 * Publish an event.
	 */
	fire<T>(event: RuntimeEvent<T>): void;
}

/**
 * Central Event Bus.
 *
 * This is the heart of the Nutanaa Runtime.
 */

export class RuntimeEventBus extends Disposable implements IRuntimeEventBus {

	declare readonly _serviceBrand: undefined;

	private readonly _emitter = this._register(
		new Emitter<RuntimeEvent>()
	);

	public readonly onEvent = this._emitter.event;

	public fire<T>(event: RuntimeEvent<T>): void {

		this._emitter.fire(event);

	}
}
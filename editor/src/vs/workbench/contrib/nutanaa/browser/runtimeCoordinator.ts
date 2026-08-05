/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../base/common/event.js';

import {
	IRuntimeCoordinator
} from '../common/runtimeCoordinator.js';

import {
	IRuntimeEventBus
} from '../common/runtimeEventBus.js';

import {
	IRuntimeEvent
} from '../common/runtimeEvent.js';

export class RuntimeCoordinator
	extends Disposable
	implements IRuntimeCoordinator {

	declare readonly _serviceBrand: undefined;

	private readonly readyEmitter =
		this._register(new Emitter<void>());

	readonly onRuntimeReady =
		this.readyEmitter.event;

	constructor(
		@IRuntimeEventBus
		private readonly eventBus: IRuntimeEventBus,
	) {
		super();

		this._register(
			this.eventBus.onEvent(
				e => this.handleRuntimeEvent(e)
			)
		);
	}

	async start(): Promise<void> {

		console.log('[Nutanaa] RuntimeCoordinator started');

		this.readyEmitter.fire();
	}

	async stop(): Promise<void> {

		console.log('[Nutanaa] RuntimeCoordinator stopped');

	}

	handleRuntimeEvent(
		event: IRuntimeEvent
	): void {

		console.log(
			'[Runtime Event]',
			event.type,
			event
		);

	}
}
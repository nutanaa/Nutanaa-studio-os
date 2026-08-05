/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import {
	Extensions as ViewContainerExtensions,
	IViewContainersRegistry,
	ViewContainerLocation,
} from '../../../common/views.js';
import {
	IWorkbenchContribution,
	registerWorkbenchContribution2,
	WorkbenchPhase,
} from '../../../common/contributions.js';

import {
	INutanaaRuntimeConnectionService,
	NUTANAA_VIEW_CONTAINER_ID
} from '../common/nutanaa.js';

import { NutanaaRuntimeConnectionService } from './nutanaaRuntimeConnectionService.js';
import { NutanaaViews } from './nutanaaViews.js';
import { nutanaaViewIcon } from './nutanaaIcons.js';

import {
	IRuntimeEventBus,
	RuntimeEventBus
} from '../common/runtimeEventBus.js';

import {
	IAgentCoordinator,
	AgentCoordinator
} from '../common/agentCoordinator.js';

import {
	IRuntimeCoordinator
} from '../common/runtimeCoordinator.js';

import {
	RuntimeCoordinator
} from './runtimeCoordinator.js';

import {
	IRuntimeStateService
} from '../common/runtimeState.js';

import {
	RuntimeStateService
} from './runtimeStateService.js';

/*---------------------------------------------------------------------------------------------
 * Service Registration
 *--------------------------------------------------------------------------------------------*/

registerSingleton(
	INutanaaRuntimeConnectionService,
	NutanaaRuntimeConnectionService,
	InstantiationType.Delayed
);

registerSingleton(
	IRuntimeEventBus,
	RuntimeEventBus,
	InstantiationType.Delayed
);

registerSingleton(
	IAgentCoordinator,
	AgentCoordinator,
	InstantiationType.Delayed
);

registerSingleton(
	IRuntimeCoordinator,
	RuntimeCoordinator,
	InstantiationType.Delayed
);

registerSingleton(
	IRuntimeStateService,
	RuntimeStateService,
	InstantiationType.Delayed
);

/*---------------------------------------------------------------------------------------------
 * Sidebar Registration
 *--------------------------------------------------------------------------------------------*/

const NUTANAA_VIEW_CONTAINER = Registry
	.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry)
	.registerViewContainer(
		{
			id: NUTANAA_VIEW_CONTAINER_ID,
			title: localize2('nutanaa', 'Nutanaa'),
			icon: nutanaaViewIcon,
			ctorDescriptor: new SyncDescriptor(
				ViewPaneContainer,
				[
					NUTANAA_VIEW_CONTAINER_ID,
					{
						mergeViewWithContainerWhenSingleView: true
					}
				]
			),
			openCommandActionDescriptor: {
				id: NUTANAA_VIEW_CONTAINER_ID,
				mnemonicTitle: localize(
					{
						key: 'miViewNutanaa',
						comment: ['&& denotes a mnemonic']
					},
					'&&Nutanaa'
				),
				order: 10
			},
			order: 10,
			alwaysUseContainerInfo: true
		},
		ViewContainerLocation.Sidebar
	);

/*---------------------------------------------------------------------------------------------
 * Nutanaa Bootstrap
 *--------------------------------------------------------------------------------------------*/

class NutanaaContribution extends Disposable implements IWorkbenchContribution {

	constructor(
		@IInstantiationService
		instantiationService: IInstantiationService,

		@INutanaaRuntimeConnectionService
		runtimeConnectionService: INutanaaRuntimeConnectionService,

		@IRuntimeEventBus
		runtimeEventBus: IRuntimeEventBus,

		@IAgentCoordinator
		agentCoordinator: IAgentCoordinator,

		@IRuntimeCoordinator
		runtimeCoordinator: IRuntimeCoordinator,

		@IRuntimeStateService
		_runtimeStateService: IRuntimeStateService,
	) {
		super();

		// Force creation of all lazy singleton services.
		// The DI container owns their lifetime.
		void runtimeEventBus;
		void agentCoordinator;
		// IRuntimeStateService must be alive before any view renders so that
		// the first onDidChangeState subscription is never missed.
		void _runtimeStateService;

		// Create the Nutanaa sidebar and all registered views.
		this._register(
			instantiationService.createInstance(
				NutanaaViews,
				NUTANAA_VIEW_CONTAINER
			)
		);

		// Start the runtime coordinator before connecting to the backend.
		// This ensures it is ready to consume runtime events immediately.
		void runtimeCoordinator.start();

		// Establish HTTP/WebSocket connection to the runtime.
		void runtimeConnectionService.connect();
	}
}

registerWorkbenchContribution2(
	'workbench.contrib.nutanaaViews',
	NutanaaContribution,
	WorkbenchPhase.AfterRestored
);
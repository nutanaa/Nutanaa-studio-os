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
import { INutanaaRuntimeConnectionService, NUTANAA_VIEW_CONTAINER_ID } from '../common/nutanaa.js';
import { NutanaaRuntimeConnectionService } from './nutanaaRuntimeConnectionService.js';
import { NutanaaViews } from './nutanaaViews.js';
import { nutanaaViewIcon } from './nutanaaIcons.js';

registerSingleton(INutanaaRuntimeConnectionService, NutanaaRuntimeConnectionService, InstantiationType.Delayed);

const NUTANAA_VIEW_CONTAINER = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer(
	{
		id: NUTANAA_VIEW_CONTAINER_ID,
		title: localize2('nutanaa', "Nutanaa"),
		icon: nutanaaViewIcon,
		ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [NUTANAA_VIEW_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
		openCommandActionDescriptor: {
			id: NUTANAA_VIEW_CONTAINER_ID,
			mnemonicTitle: localize({ key: 'miViewNutanaa', comment: ['&& denotes a mnemonic'] }, "&&Nutanaa"),
			order: 10,
		},
		order: 10,
		alwaysUseContainerInfo: true,
	},
	ViewContainerLocation.Sidebar
);

/**
 * Instantiates {@link NutanaaViews} once the workbench has restored its UI
 * state, and kicks off the one and only connect() call to the Nutanaa
 * Runtime backend. Nothing else in the codebase calls connect() —
 * this is deliberately the single place it happens.
 */
class NutanaaContribution extends Disposable implements IWorkbenchContribution {
	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@INutanaaRuntimeConnectionService runtimeConnectionService: INutanaaRuntimeConnectionService,
	) {
		super();
		this._register(instantiationService.createInstance(NutanaaViews, NUTANAA_VIEW_CONTAINER));
		runtimeConnectionService.connect();
	}
}

registerWorkbenchContribution2(
	'workbench.contrib.nutanaaViews',
	NutanaaContribution,
	WorkbenchPhase.AfterRestored
);
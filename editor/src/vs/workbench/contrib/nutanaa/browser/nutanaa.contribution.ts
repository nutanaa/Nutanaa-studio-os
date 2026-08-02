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

// Runtime connection service — the single seam between the editor UI and
// the (not yet implemented) FastAPI/WebSocket bridge to the Python runtime
// core. Registered `Delayed` since nothing needs it until a Nutanaa view
// actually becomes visible.
registerSingleton(INutanaaRuntimeConnectionService, NutanaaRuntimeConnectionService, InstantiationType.Delayed);

// View container — the Activity Bar entry hosting all Nutanaa sidebar
// views (Agent Explorer today; Workflow/Provider/Memory/Task Explorers
// follow the same registration pattern as they're added).
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
 * state. `registerWorkbenchContribution2` only supports pure DI
 * constructors, so this thin wrapper is what carries the already-resolved
 * {@link NUTANAA_VIEW_CONTAINER} into `NutanaaViews`, mirroring how VS
 * Code's own `userDataSync` contribution wires `UserDataSyncDataViews`.
 */
class NutanaaContribution extends Disposable implements IWorkbenchContribution {
	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();
		this._register(instantiationService.createInstance(NutanaaViews, NUTANAA_VIEW_CONTAINER));
	}
}

registerWorkbenchContribution2(
	'workbench.contrib.nutanaaViews',
	NutanaaContribution,
	WorkbenchPhase.AfterRestored
);
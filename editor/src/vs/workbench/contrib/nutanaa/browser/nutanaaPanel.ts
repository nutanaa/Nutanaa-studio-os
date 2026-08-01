/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ViewContainerLocation, IViewContainersRegistry, Extensions as ViewContainerExtensions } from '../../../common/views.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { NUTANAA_PANEL_CONTAINER_ID } from './constants.js';
import { nutanaaIconChat } from './theme.js';
import { localize } from '../../../../nls.js';

export class NutanaaPanelContribution extends Disposable {
	constructor() {
		super();
		this.registerPanelContainer();
	}

	private registerPanelContainer(): void {
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
		viewContainersRegistry.registerViewContainer({
			id: NUTANAA_PANEL_CONTAINER_ID,
			title: { value: localize('nutanaaPanelTitle', 'Nutanaa Workbench'), original: 'Nutanaa Workbench' },
			icon: nutanaaIconChat,
			ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [NUTANAA_PANEL_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: false }]),
			storageId: 'nutanaa.panel.state',
			order: 10,
			rejectAddedViews: false
		}, ViewContainerLocation.Panel);
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ViewContainerLocation, IViewContainersRegistry, Extensions as ViewContainerExtensions, IViewDescriptorService } from '../../../common/views.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { NUTANAA_VIEW_CONTAINER_ID, NutanaaContextKey } from './constants.js';
import { nutanaaIconActivityContainer } from './theme.js';
import { localize } from '../../../../nls.js';
import { IContextKeyService, IContextKey } from '../../../../platform/contextkey/common/contextkey.js';

export class NutanaaActivityBarContribution extends Disposable {
	private readonly isRuntimeActive: IContextKey<boolean>;

	constructor(
		@IViewDescriptorService private readonly viewDescriptorService: IViewDescriptorService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService
	) {
		super();
		this.isRuntimeActive = NutanaaContextKey.RuntimeActive.bindTo(this.contextKeyService);
		this.registerActivityBarContainer();
	}

	protected get _viewDescriptors(): IViewDescriptorService {
		return this.viewDescriptorService;
	}

	private registerActivityBarContainer(): void {
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
		const container = viewContainersRegistry.registerViewContainer({
			id: NUTANAA_VIEW_CONTAINER_ID,
			title: { value: localize('nutanaaActivityTitle', 'Nutanaa Studio OS'), original: 'Nutanaa Studio OS' },
			icon: nutanaaIconActivityContainer,
			ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [NUTANAA_VIEW_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: false }]),
			storageId: 'nutanaa.activity.state',
			order: 1,
			rejectAddedViews: false
		}, ViewContainerLocation.Sidebar);

		if (container) {
			this.isRuntimeActive.set(true);
		}
	}
}

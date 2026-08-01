/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IViewDescriptorService, ViewContainerLocation } from '../../../common/views.js';
import { NUTANAA_VIEW_CONTAINER_ID, NutanaaStorageKey } from './constants.js';

export class NutanaaSidebarContribution extends Disposable {
	private static readonly DEFAULT_WIDTH = 320;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IViewDescriptorService private readonly viewDescriptorService: IViewDescriptorService
	) {
		super();
		this.restoreSidebarState();
	}

	private restoreSidebarState(): void {
		const savedWidth = this.storageService.getNumber(NutanaaStorageKey.SidebarWidth, StorageScope.PROFILE, NutanaaSidebarContribution.DEFAULT_WIDTH);
		this.applyWidth(savedWidth);
	}

	public saveWidth(width: number): void {
		this.storageService.store(NutanaaStorageKey.SidebarWidth, width, StorageScope.PROFILE, StorageTarget.USER);
	}

	private applyWidth(width: number): void {
		const container = this.viewDescriptorService.getViewContainerById(NUTANAA_VIEW_CONTAINER_ID);
		if (container) {
			this.viewDescriptorService.moveViewContainerToLocation(container, ViewContainerLocation.Sidebar);
		}
	}
}

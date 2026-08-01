/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';

export class NutanaaStartupContribution extends Disposable {
	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@INotificationService private readonly notificationService: INotificationService
	) {
		super();
		this.initializeRuntimeState();
	}

	private initializeRuntimeState(): void {
		const isFirstRun = this.storageService.getBoolean('nutanaa.firstRun', StorageScope.PROFILE, true);
		if (isFirstRun) {
			this.notificationService.info('Welcome to Nutanaa Studio OS Workbench.');
			this.storageService.store('nutanaa.firstRun', false, StorageScope.PROFILE, StorageTarget.USER);
		}
	}
}

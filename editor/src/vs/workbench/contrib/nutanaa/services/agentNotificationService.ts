/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';

export const IAgentNotificationService = createDecorator<IAgentNotificationService>('agentNotificationService');

export interface IAgentNotificationService {
	readonly _serviceBrand: undefined;
	notifyInfo(message: string): void;
	notifyWarning(message: string): void;
	notifyError(message: string): void;
}

export class AgentNotificationService extends Disposable implements IAgentNotificationService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@INotificationService private readonly notificationService: INotificationService
	) {
		super();
	}

	public notifyInfo(message: string): void {
		this.notificationService.notify({ severity: Severity.Info, message: `[Nutanaa Agent] ${message}` });
	}

	public notifyWarning(message: string): void {
		this.notificationService.notify({ severity: Severity.Warning, message: `[Nutanaa Agent] ${message}` });
	}

	public notifyError(message: string): void {
		this.notificationService.notify({ severity: Severity.Error, message: `[Nutanaa Agent] ${message}` });
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';

export class NutanaaNotificationCenter extends Disposable {
	constructor(
		@INotificationService private readonly notificationService: INotificationService
	) {
		super();
	}

	public notifyAgentFailure(agentName: string, error: string): void {
		this.notificationService.notify({
			severity: Severity.Error,
			message: `Nutanaa Agent [${agentName}] crashed: ${error}`,
			actions: {
				primary: []
			}
		});
	}

	public notifyWorkflowComplete(workflowName: string): void {
		this.notificationService.info(`Nutanaa Workflow [${workflowName}] completed successfully.`);
	}
}

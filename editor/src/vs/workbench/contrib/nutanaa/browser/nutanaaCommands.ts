/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { NutanaaCommandId, NutanaaViewId, NutanaaPanelId } from './constants.js';

export class NutanaaCommandsContribution extends Disposable {
	constructor(
		@IViewsService private readonly viewsService: IViewsService,
		@INotificationService private readonly notificationService: INotificationService
	) {
		super();
		this.registerCommands();
	}

	private registerCommands(): void {
		this._register(CommandsRegistry.registerCommand(NutanaaCommandId.OpenHome, async () => {
			await this.viewsService.openView(NutanaaViewId.Welcome, true);
		}));

		this._register(CommandsRegistry.registerCommand(NutanaaCommandId.OpenChat, async () => {
			await this.viewsService.openView(NutanaaPanelId.Chat, true);
		}));

		this._register(CommandsRegistry.registerCommand(NutanaaCommandId.StartAgent, async () => {
			this.notificationService.info('Nutanaa: Spawning core background task agent...');
		}));

		this._register(CommandsRegistry.registerCommand(NutanaaCommandId.StopAgent, async () => {
			this.notificationService.warn('Nutanaa: Halting all active agent tasks...');
		}));

		this._register(CommandsRegistry.registerCommand(NutanaaCommandId.RefreshProviders, async () => {
			this.notificationService.info('Nutanaa: Provider status matrix refreshed.');
		}));

		this._register(CommandsRegistry.registerCommand(NutanaaCommandId.ShowLogs, async () => {
			await this.viewsService.openView(NutanaaPanelId.Logs, true);
		}));

		this._register(CommandsRegistry.registerCommand(NutanaaCommandId.ReloadRuntime, async () => {
			this.notificationService.notify({ severity: Severity.Info, message: 'Nutanaa: Reloading AI Runtime Core...' });
		}));
	}
}

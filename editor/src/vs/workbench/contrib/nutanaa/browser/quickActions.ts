/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { NutanaaCommandId } from './constants.js';

export class QuickActionsRegistry extends Disposable {
	constructor(
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@ICommandService private readonly commandService: ICommandService
	) {
		super();
	}

	public async promptQuickAction(): Promise<void> {
		const pick = await this.quickInputService.pick([
			{ label: '$(comment-discussion) Open AI Chat', id: NutanaaCommandId.OpenChat },
			{ label: '$(play) Spawn Code Refactoring Agent', id: NutanaaCommandId.StartAgent },
			{ label: '$(output) View Runtime Logs', id: NutanaaCommandId.ShowLogs }
		], { placeHolder: 'Select a Nutanaa Studio Quick Action...' });

		if (pick && pick.id) {
			await this.commandService.executeCommand(pick.id);
		}
	}
}

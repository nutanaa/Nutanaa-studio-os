/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { MenuRegistry, MenuId } from '../../../../platform/actions/common/actions.js';
import { NutanaaCommandId } from './constants.js';
import { localize } from '../../../../nls.js';

export class NutanaaMenusContribution extends Disposable {
	constructor() {
		super();
		this.registerMenus();
	}

	private registerMenus(): void {
		MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
			command: {
				id: NutanaaCommandId.OpenHome,
				title: localize('nutanaa.openHome', 'Nutanaa: Open Home Dashboard')
			}
		});

		MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
			command: {
				id: NutanaaCommandId.OpenChat,
				title: localize('nutanaa.openChat', 'Nutanaa: Open AI Chat Workbench')
			}
		});

		MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
			command: {
				id: NutanaaCommandId.StartAgent,
				title: localize('nutanaa.startAgent', 'Nutanaa: Start Agent Context Processing')
			}
		});

		MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
			command: {
				id: NutanaaCommandId.StartAgent,
				title: localize('nutanaa.analyzeFile', 'Nutanaa: Analyze with AI Agent')
			},
			group: 'nutanaa_actions',
			order: 1
		});
	}
}

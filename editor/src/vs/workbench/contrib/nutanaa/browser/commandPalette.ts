/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICommandService } from '../../../../platform/commands/common/commands.js';

export class NutanaaCommandPalette {
	constructor(
		@ICommandService commandService: ICommandService
	) {
		void commandService;
	}
}

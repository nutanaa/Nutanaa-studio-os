/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IMenuService, MenuId } from '../../../../platform/actions/common/actions.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';

export class NutanaaToolbarContribution extends Disposable {
	constructor(
		@IMenuService private readonly menuService: IMenuService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService
	) {
		super();
		this.initToolbar();
	}

	private initToolbar(): void {
		this._register(this.menuService.createMenu(MenuId.ViewTitle, this.contextKeyService));
	}
}

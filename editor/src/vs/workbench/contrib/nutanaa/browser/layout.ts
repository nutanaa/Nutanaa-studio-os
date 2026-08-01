/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';

export class NutanaaLayoutContribution extends Disposable {
	constructor(
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService
	) {
		super();
	}

	protected get _layout(): IWorkbenchLayoutService {
		return this.layoutService;
	}
}

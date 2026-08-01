/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IStatusbarService, StatusbarAlignment, IStatusbarEntryAccessor } from '../../../services/statusbar/browser/statusbar.js';
import { NutanaaCommandId } from './constants.js';

export class NutanaaStatusbarContribution extends Disposable {
	private providerEntry!: IStatusbarEntryAccessor;

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService
	) {
		super();
		this.renderStatusbar();
	}

	private renderStatusbar(): void {
		this.providerEntry = this.statusbarService.addEntry({
			name: 'Nutanaa AI Engine',
			text: '$(sparkle) Nutanaa: Claude 3.5',
			ariaLabel: 'Nutanaa Engine Status',
			tooltip: 'Active Model: Anthropic Claude 3.5 Sonnet | Latency: 120ms',
			command: NutanaaCommandId.OpenChat
		}, 'nutanaa.statusbar.provider', StatusbarAlignment.RIGHT, 100);

		this._register({
			dispose: () => this.providerEntry.dispose()
		});
	}
}

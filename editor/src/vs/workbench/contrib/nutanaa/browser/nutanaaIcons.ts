/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { localize } from '../../../../nls.js';

/**
 * Main icon for Nutanaa Studio OS view container (Activity Bar).
 * Uses Codicon.circuitBoard until a proper themeable custom icon is wired
 * in (registerIcon supports custom SVG icon definitions directly — no CSS
 * injection needed — that's the right way to swap this in later).
 */
export const nutanaaViewIcon = registerIcon(
	'nutanaa-view-icon',
	Codicon.circuitBoard,
	localize('nutanaaViewIcon', 'The icon of the Nutanaa view container.')
);

/**
 * Icon for the Agent Explorer view.
 */
export const nutanaaAgentExplorerIcon = registerIcon(
	'nutanaa-agent-explorer-icon',
	Codicon.organization,
	localize('nutanaaAgentExplorerIcon', 'Icon of the Nutanaa Agent Explorer view.')
);

/**
 * Icon for the refresh action shown in the Agent Explorer view title.
 */
export const nutanaaRefreshIcon = registerIcon(
	'nutanaa-refresh',
	Codicon.refresh,
	localize('nutanaaRefreshIcon', "Icon for the 'Refresh' action in the Nutanaa Agent Explorer view.")
);
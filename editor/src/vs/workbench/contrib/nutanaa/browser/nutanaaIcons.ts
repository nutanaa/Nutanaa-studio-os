/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { FileAccess } from '../../../../base/common/network.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { localize } from '../../../../nls.js';

// 1. Resolve image path to browser URI
const iconUri = FileAccess.asBrowserUri(
	'vs/workbench/contrib/nutanaa/browser/media/NutanaaActivityIcon.png'
).toString(true);

// 2. Inject CSS rules directly into DOM when this module is loaded
if (typeof document !== 'undefined') {
	const styleElement = document.createElement('style');
	styleElement.textContent = `
		/* Hide default font glyph */
		.codicon-nutanaa-view-icon::before {
			content: '' !important;
			display: none !important;
		}

		/* Render image in activity bar */
		.codicon-nutanaa-view-icon {
			width: 20px !important;
			height: 20px !important;
			background-image: url('${iconUri}') !important;
			background-size: contain !important;
			background-repeat: no-repeat !important;
			background-position: center !important;
			border-radius: 4px;
		}
	`;
	document.head.appendChild(styleElement);
}

/**
 * Main icon for Nutanaa Studio OS view container (Activity Bar).
 * Uses Codicon.circuitBoard to satisfy VS Code's internal IconDefaults type.
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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerColor } from '../../../../platform/theme/common/colorRegistry.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { localize } from '../../../../nls.js';

export const nutanaaActivityBarBackground = registerColor(
	'nutanaa.activityBar.background',
	{ dark: '#1E1E2E', light: '#F0F0F8', hcDark: '#000000', hcLight: '#FFFFFF' },
	localize('nutanaaActivityBarBackground', 'Nutanaa Activity Bar background color.')
);

export const nutanaaBadgeBackground = registerColor(
	'nutanaa.badge.background',
	{ dark: '#74C7EC', light: '#005FB8', hcDark: '#74C7EC', hcLight: '#005FB8' },
	localize('nutanaaBadgeBackground', 'Nutanaa badge background color.')
);

export const nutanaaBadgeForeground = registerColor(
	'nutanaa.badge.foreground',
	{ dark: '#11111B', light: '#FFFFFF', hcDark: '#000000', hcLight: '#FFFFFF' },
	localize('nutanaaBadgeForeground', 'Nutanaa badge foreground color.')
);

export const nutanaaBorderColor = registerColor(
	'nutanaa.border',
	{ dark: '#313244', light: '#E0E0E0', hcDark: '#666666', hcLight: '#CCCCCC' },
	localize('nutanaaBorderColor', 'Nutanaa split and container border color.')
);

export const nutanaaIconHome = registerIcon('nutanaa-home', Codicon.home, localize('nutanaaIconHome', 'Icon for Nutanaa Home View.'));
export const nutanaaIconAgent = registerIcon('nutanaa-agent', Codicon.robot, localize('nutanaaIconAgent', 'Icon for Nutanaa Agent Explorer.'));
export const nutanaaIconWorkflow = registerIcon('nutanaa-workflow', Codicon.circuitBoard, localize('nutanaaIconWorkflow', 'Icon for Nutanaa Workflow Explorer.'));
export const nutanaaIconProvider = registerIcon('nutanaa-provider', Codicon.server, localize('nutanaaIconProvider', 'Icon for Nutanaa Provider Explorer.'));
export const nutanaaIconMemory = registerIcon('nutanaa-memory', Codicon.database, localize('nutanaaIconMemory', 'Icon for Nutanaa Memory Explorer.'));
export const nutanaaIconTask = registerIcon('nutanaa-task', Codicon.tasklist, localize('nutanaaIconTask', 'Icon for Nutanaa Task Explorer.'));
export const nutanaaIconKnowledge = registerIcon('nutanaa-knowledge', Codicon.graph, localize('nutanaaIconKnowledge', 'Icon for Nutanaa Project Knowledge.'));
export const nutanaaIconChat = registerIcon('nutanaa-chat', Codicon.commentDiscussion, localize('nutanaaIconChat', 'Icon for Nutanaa Chat Panel.'));
export const nutanaaIconLogs = registerIcon('nutanaa-logs', Codicon.output, localize('nutanaaIconLogs', 'Icon for Nutanaa Logs Panel.'));
export const nutanaaIconEvents = registerIcon('nutanaa-events', Codicon.pulse, localize('nutanaaIconEvents', 'Icon for Nutanaa Events Panel.'));
export const nutanaaIconActivityContainer = registerIcon('nutanaa-activity-container', Codicon.sparkle, localize('nutanaaIconActivityContainer', 'Icon for Nutanaa Activity Bar entry.'));

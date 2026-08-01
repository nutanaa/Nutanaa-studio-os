// src/vs/workbench/contrib/nutanaa/browser/constants.ts

import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';

export const NUTANAA_VIEW_CONTAINER_ID = 'workbench.view.nutanaa';
export const NUTANAA_PANEL_CONTAINER_ID = 'workbench.panel.nutanaa';

export const NUTANAA_ACTIVITY_ID = 'workbench.activity.nutanaa';

export namespace NutanaaViewId {
	export const Welcome = 'nutanaa.view.welcome';
	export const AgentExplorer = 'nutanaa.view.agentExplorer';
	export const WorkflowExplorer = 'nutanaa.view.workflowExplorer';
	export const ProviderExplorer = 'nutanaa.view.providerExplorer';
	export const MemoryExplorer = 'nutanaa.view.memoryExplorer';
	export const TaskExplorer = 'nutanaa.view.taskExplorer';
	export const ProjectKnowledge = 'nutanaa.view.projectKnowledge';
	export const ProjectExplorer = 'nutanaa.view.projectExplorer';
}

export namespace NutanaaPanelId {
	export const Chat = 'nutanaa.panel.chat';
	export const Logs = 'nutanaa.panel.logs';
	export const Events = 'nutanaa.panel.events';
	export const AgentMonitor = 'nutanaa.panel.agentMonitor';
	export const WorkflowMonitor = 'nutanaa.panel.workflowMonitor';
	export const ProviderStatus = 'nutanaa.panel.providerStatus';
}

export namespace NutanaaCommandId {
	export const OpenHome = 'nutanaa.command.openHome';
	export const OpenChat = 'nutanaa.command.openChat';
	export const StartAgent = 'nutanaa.command.startAgent';
	export const StopAgent = 'nutanaa.command.stopAgent';
	export const RefreshProviders = 'nutanaa.command.refreshProviders';
	export const OpenWorkflow = 'nutanaa.command.openWorkflow';
	export const OpenMemory = 'nutanaa.command.openMemory';
	export const ShowLogs = 'nutanaa.command.showLogs';
	export const ReloadRuntime = 'nutanaa.command.reloadRuntime';
	export const RestartRuntime = 'nutanaa.command.restartRuntime';
	export const ClearLogs = 'nutanaa.command.clearLogs';
	export const ExecuteQuickAction = 'nutanaa.command.executeQuickAction';
}

export namespace NutanaaContextKey {
	export const RuntimeActive = new RawContextKey<boolean>('nutanaaRuntimeActive', false);
	export const ActiveAgentCount = new RawContextKey<number>('nutanaaActiveAgentCount', 0);
	export const ActiveProvider = new RawContextKey<string>('nutanaaActiveProvider', '');
	export const ViewFocused = new RawContextKey<boolean>('nutanaaViewFocused', false);
}

export namespace NutanaaStorageKey {
	export const LayoutState = 'nutanaa.storage.layoutState';
	export const SidebarWidth = 'nutanaa.storage.sidebarWidth';
	export const ActiveSession = 'nutanaa.storage.activeSession';
	export const QuickActionHistory = 'nutanaa.storage.quickActionHistory';
}

export namespace NutanaaConfigKey {
	export const AutoStartRuntime = 'nutanaa.runtime.autoStart';
	export const DefaultProvider = 'nutanaa.provider.default';
	export const LogLevel = 'nutanaa.logging.level';
	export const MaxMemoryMB = 'nutanaa.runtime.maxMemoryMB';
}


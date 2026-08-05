/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import {
	IPlugin,
	IPluginManifest,
	IPluginDependency,
	IPluginContributions,
} from '../models/enterpriseModel.js';

/**
 * Service for managing plugins in Nutanaa Studio OS Enterprise.
 *
 * Responsibilities:
 * - Plugin discovery and discovery providers
 * - Plugin loading, unloading, and lifecycle management
 * - Plugin isolation and sandboxing
 * - Dependency resolution and version management
 * - Plugin SDK support (commands, views, panels, providers, tools, workflows, themes)
 */
export const IPluginManager = createDecorator<IPluginManager>('nutanaaPluginManager');

export interface IPluginManager {

	// ── Discovery ───────────────────────────────────────────────────────────

	/**
	 * Discover installed plugins.
	 * @returns Array of installed plugins
	 */
	discoverInstalled(): Promise<IPlugin[]>;

	/**
	 * Discover plugins from a directory.
	 * @param path The directory path
	 * @returns Array of discovered plugins
	 */
	discoverFromDirectory(path: string): Promise<IPlugin[]>;

	/**
	 * Register a plugin discovery provider.
	 * @param providerId The provider ID
	 * @param handler Handler function
	 */
	registerDiscoveryProvider(providerId: string, handler: () => Promise<IPlugin[]>): void;

	// ── Lifecycle ───────────────────────────────────────────────────────────

	/**
	 * Load a plugin.
	 * @param pluginId The plugin ID
	 * @returns Loaded plugin
	 */
	loadPlugin(pluginId: string): Promise<IPlugin>;

	/**
	 * Unload a plugin.
	 * @param pluginId The plugin ID
	 */
	unloadPlugin(pluginId: string): Promise<void>;

	/**
	 * Enable a plugin.
	 * @param pluginId The plugin ID
	 */
	enablePlugin(pluginId: string): void;

	/**
	 * Disable a plugin.
	 * @param pluginId The plugin ID
	 */
	disablePlugin(pluginId: string): void;

	/**
	 * Get all installed plugins.
	 * @returns Map of plugin ID to plugin
	 */
	getInstalledPlugins(): Map<string, IPlugin>;

	/**
	 * Get loaded plugins.
	 * @returns Array of loaded plugins
	 */
	getLoadedPlugins(): IPlugin[];

	/**
	 * Get enabled plugins.
	 * @returns Array of enabled plugins
	 */
	getEnabledPlugins(): IPlugin[];

	// ── Installation ─────────────────────────────────────────────────────────

	/**
	 * Install a plugin from a path or URL.
	 * @param source Plugin source (path or URL)
	 * @returns Installed plugin
	 */
	installPlugin(source: string): Promise<IPlugin>;

	/**
	 * Uninstall a plugin.
	 * @param pluginId The plugin ID
	 */
	uninstallPlugin(pluginId: string): Promise<void>;

	/**
	 * Update a plugin to a new version.
	 * @param pluginId The plugin ID
	 * @param version The new version
	 * @returns Updated plugin
	 */
	updatePlugin(pluginId: string, version: string): Promise<IPlugin>;

	// ── Dependencies ─────────────────────────────────────────────────────────

	/**
	 * Check plugin dependencies.
	 * @param plugin The plugin
	 * @returns Array of dependency status
	 */
	checkDependencies(plugin: IPlugin): Promise<IPluginDependency[]>;

	/**
	 * Resolve plugin dependencies.
	 * @param plugin The plugin
	 * @returns Resolved plugin
	 */
	resolveDependencies(plugin: IPlugin): Promise<IPlugin>;

	// ── Contributions ────────────────────────────────────────────────────────

	/**
	 * Get all registered commands.
	 * @returns Array of command contributions
	 */
	getCommands(): Array<{ id: string; title: string; category?: string }>;

	/**
	 * Get all registered views.
	 * @returns Array of view contributions
	 */
	getViews(): Array<{ id: string; name: string; type: string }>;

	/**
	 * Get all registered panels.
	 * @returns Array of panel contributions
	 */
	getPanels(): Array<{ id: string; title: string }>;

	/**
	 * Get all registered configuration.
	 * @returns Configuration object
	 */

	getConfiguration(): Record<string, unknown>;

	/**
	 * Get all registered menus.
	 * @returns Array of menu contributions
	 */
	getMenus(): Array<{ id: string; items: Array<{ command: string }> }>;

	// ── SDK Access ───────────────────────────────────────────────────────────

	/**
	 * Get plugin API by ID.
	 * @param pluginId The plugin ID
	 * @returns Plugin API or undefined
	 */
	getPluginApi<T = unknown>(pluginId: string): T | undefined;

	/**
	 * Register a command from a plugin.
	 * @param pluginId The plugin ID
	 * @param command The command definition
	 * @param handler Command handler
	 */
	registerCommand(
		pluginId: string,
		command: { id: string; title: string; category?: string },
		handler: (...args: unknown[]) => unknown
	): void;

	/**
	 * Register a view from a plugin.
	 * @param pluginId The plugin ID
	 * @param view The view definition
	 */
	registerView(
		pluginId: string,
		view: { id: string; name: string; type: string }
	): void;

	/**
	 * Register a panel from a plugin.
	 * @param pluginId The plugin ID
	 * @param panel The panel definition
	 */
	registerPanel(
		pluginId: string,
		panel: { id: string; title: string }
	): void;

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when a plugin is installed.
	 */
	onDidInstallPlugin: (listener: (plugin: IPlugin) => void) => { dispose(): void };

	/**
	 * Event fired when a plugin is uninstalled.
	 */
	onDidUninstallPlugin: (listener: (pluginId: string) => void) => { dispose(): void };

	/**
	 * Event fired when a plugin is loaded.
	 */
	onDidLoadPlugin: (listener: (plugin: IPlugin) => void) => { dispose(): void };

	/**
	 * Event fired when a plugin is unloaded.
	 */
	onDidUnloadPlugin: (listener: (pluginId: string) => void) => { dispose(): void };

	/**
	 * Event fired when a plugin encounters an error.
	 */
	onDidPluginError: (listener: (pluginId: string, error: string) => void) => { dispose(): void };
}
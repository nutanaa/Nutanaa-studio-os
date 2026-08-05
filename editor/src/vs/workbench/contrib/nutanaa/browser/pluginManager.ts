/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import {
	IPlugin,
	IPluginManifest,
	IPluginDependency,
	IPluginContributions,
} from '../models/enterpriseModel.js';
import { IPluginManager } from '../common/pluginManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../common/runtimeEventBus.js';
import { IRuntimeStateService } from '../common/runtimeState.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';

/**
 * PluginManager implementation for Nutanaa Studio OS Enterprise.
 *
 * Manages plugin lifecycle, isolation, dependencies, and contributions.
 */
export class PluginManager extends Disposable implements IPluginManager {

	declare readonly _serviceBrand: undefined;

	private readonly plugins = new Map<string, IPlugin>();
	private readonly pluginApis = new Map<string, unknown>();
	private readonly pluginCommands = new Map<string, Map<string, { handler: (...args: unknown[]) => unknown }>>();
	private readonly pluginViews = new Map<string, Array<{ id: string; name: string; type: string }>>();
	private readonly pluginPanels = new Map<string, Array<{ id: string; title: string }>>();
	private readonly pluginConfiguration = new Map<string, Record<string, unknown>>();
	private readonly pluginMenus = new Map<string, Array<{ id: string; items: Array<{ command: string }> }>>();
	private readonly discoveryProviders = new Map<string, () => Promise<IPlugin[]>>();

	private readonly _onDidInstallPlugin = this._register(new Emitter<IPlugin>());
	private readonly _onDidUninstallPlugin = this._register(new Emitter<{ pluginId: string }>());
	private readonly _onDidLoadPlugin = this._register(new Emitter<IPlugin>());
	private readonly _onDidUnloadPlugin = this._register(new Emitter<{ pluginId: string }>());
	private readonly _onDidPluginError = this._register(new Emitter<{ pluginId: string; error: string }>());

	public readonly onDidInstallPlugin = Event.fromEmitter(this._onDidInstallPlugin);
	public readonly onDidUninstallPlugin = Event.fromEmitter(this._onDidUninstallPlugin);
	public readonly onDidLoadPlugin = Event.fromEmitter(this._onDidLoadPlugin);
	public readonly onDidUnloadPlugin = Event.fromEmitter(this._onDidUnloadPlugin);
	public readonly onDidPluginError = Event.fromEmitter(this._onDidPluginError);

	private readonly PLUGIN_ROOT = 'plugins';
	private readonly pluginContexts = new Map<string, unknown>();

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.loadPlugins();
	}

	// ── Discovery ───────────────────────────────────────────────────────────

	async discoverInstalled(): Promise<IPlugin[]> {
		const plugins: IPlugin[] = [];

		// Run all discovery providers
		for (const [, handler] of this.discoveryProviders) {
			const discovered = await handler();
			plugins.push(...discovered);
		}

		return plugins;
	}

	async discoverFromDirectory(path: string): Promise<IPlugin[]> {
		const plugins: IPlugin[] = [];

		// Discover plugin manifests in directory
		// Real implementation would scan directory structure

		return plugins;
	}

	registerDiscoveryProvider(providerId: string, handler: () => Promise<IPlugin[]>): void {
		this.discoveryProviders.set(providerId, handler);
		this.logService.info(`Plugin discovery provider ${providerId} registered`);
	}

	// ── Lifecycle ───────────────────────────────────────────────────────────

	async loadPlugin(pluginId: string): Promise<IPlugin> {
		const plugin = this.plugins.get(pluginId);
		if (!plugin) {
			throw new Error(`Plugin ${pluginId} not found`);
		}

		if (plugin.state === 'loaded') {
			return plugin;
		}

		try {
			// Update state to loading
			plugin.state = 'loading';
			this.plugins.set(pluginId, plugin);

			// Check dependencies first
			const dependencies = await this.checkDependencies(plugin);
			const missingDeps = dependencies.filter(d => !d.satisfied);
			if (missingDeps.length > 0) {
				throw new Error(`Missing dependencies: ${missingDeps.map(d => d.pluginId).join(', ')}`);
			}

			// Create isolated context for plugin
			const context = this.createIsolatedContext(plugin);
			this.pluginContexts.set(pluginId, context);

			// Load plugin main module
			if (plugin.manifest.main) {
				// Real implementation would use require() or dynamic import
			}

			// Register contributions
			this.registerContributions(plugin);

			// Mark as loaded
			plugin.state = 'loaded';
			plugin.error = undefined;
			this.plugins.set(pluginId, plugin);

			// Update runtime state
			this.updatePluginsState();

			// Fire events
			this._onDidLoadPlugin.fire(plugin);

			this.runtimeEventBus.fire({
				type: RuntimeEventType.PluginLoaded,
				timestamp: Date.now(),
				payload: { pluginId, name: plugin.manifest.name },
			});

			this.logService.info(`Plugin ${plugin.manifest.name} loaded`);

			return plugin;
		} catch (error) {
			plugin.state = 'error';
			plugin.error = String(error);
			this.plugins.set(pluginId, plugin);

			this._onDidPluginError.fire({ pluginId, error: String(error) });

			throw error;
		}
	}

	async unloadPlugin(pluginId: string): Promise<void> {
		const plugin = this.plugins.get(pluginId);
		if (!plugin) {
			return;
		}

		try {
			plugin.state = 'unloading';
			this.plugins.set(pluginId, plugin);

			// Unregister contributions
			this.unregisterContributions(pluginId);

			// Clear plugin context
			this.pluginContexts.delete(pluginId);

			// Mark as installed (not loaded)
			plugin.state = 'installed';
			this.plugins.set(pluginId, plugin);

			// Update runtime state
			this.updatePluginsState();

			// Fire events
			this._onDidUnloadPlugin.fire({ pluginId });

			this.runtimeEventBus.fire({
				type: RuntimeEventType.PluginUnloaded,
				timestamp: Date.now(),
				payload: { pluginId, name: plugin.manifest.name },
			});

			this.logService.info(`Plugin ${plugin.manifest.name} unloaded`);
		} catch (error) {
			this.logService.error(`Failed to unload plugin ${pluginId}: ${error}`);
			throw error;
		}
	}

	enablePlugin(pluginId: string): void {
		const plugin = this.plugins.get(pluginId);
		if (!plugin) {
			return;
		}

		plugin.enabled = true;
		this.plugins.set(pluginId, plugin);

		// Auto-load if was previously loaded
		if (plugin.state === 'installed') {
			this.loadPlugin(pluginId).catch(() => {});
		}

		this.updatePluginsState();
		this.logService.info(`Plugin ${plugin.manifest.name} enabled`);
	}

	disablePlugin(pluginId: string): void {
		const plugin = this.plugins.get(pluginId);
		if (!plugin) {
			return;
		}

		plugin.enabled = false;
		this.plugins.set(pluginId, plugin);

		// Unload if currently loaded
		if (plugin.state === 'loaded') {
			this.unloadPlugin(pluginId).catch(() => {});
		}

		this.updatePluginsState();
		this.logService.info(`Plugin ${plugin.manifest.name} disabled`);
	}

	getInstalledPlugins(): Map<string, IPlugin> {
		return new Map(this.plugins);
	}

	getLoadedPlugins(): IPlugin[] {
		return Array.from(this.plugins.values()).filter(p => p.state === 'loaded');
	}

	getEnabledPlugins(): IPlugin[] {
		return Array.from(this.plugins.values()).filter(p => p.enabled);
	}

	// ── Installation ─────────────────────────────────────────────────────────

	async installPlugin(source: string): Promise<IPlugin> {
		// Download and extract plugin
		// Real implementation would fetch from URL or extract from local path

		const manifest: IPluginManifest = {
			id: `plugin-${Date.now()}`,
			name: 'New Plugin',
			version: '1.0.0',
			displayName: 'New Plugin',
			description: 'A new plugin',
			author: 'Nutanaa',
			categories: ['other'],
			activationEvents: ['*'],
		};

		const plugin: IPlugin = {
			id: manifest.id,
			manifest,
			path: source,
			state: 'installed',
			installedAt: Date.now(),
			updatedAt: Date.now(),
			enabled: true,
		};

		this.plugins.set(plugin.id, plugin);
		this.savePlugins();

		// Update runtime state
		this.updatePluginsState();

		// Fire events
		this._onDidInstallPlugin.fire(plugin);

		this.runtimeEventBus.fire({
			type: RuntimeEventType.PluginInstalled,
			timestamp: Date.now(),
			payload: {
				pluginId: plugin.id,
				version: plugin.manifest.version,
				userId: 'current-user',
			},
		});

		this.logService.info(`Plugin ${plugin.manifest.name} installed`);

		return plugin;
	}

	async uninstallPlugin(pluginId: string): Promise<void> {
		const plugin = this.plugins.get(pluginId);
		if (!plugin) {
			return;
		}

		// Unload if loaded
		if (plugin.state === 'loaded') {
			await this.unloadPlugin(pluginId);
		}

		// Remove from registry
		this.plugins.delete(pluginId);

		// Clean up contributions
		this.unregisterContributions(pluginId);

		// Save and update state
		this.savePlugins();
		this.updatePluginsState();

		// Fire events
		this._onDidUninstallPlugin.fire({ pluginId });

		this.runtimeEventBus.fire({
			type: RuntimeEventType.PluginRemoved,
			timestamp: Date.now(),
			payload: { pluginId },
		});

		this.logService.info(`Plugin ${plugin.manifest.name} uninstalled`);
	}

	async updatePlugin(pluginId: string, version: string): Promise<IPlugin> {
		const plugin = this.plugins.get(pluginId);
		if (!plugin) {
			throw new Error(`Plugin ${pluginId} not found`);
		}

		// Unload current version
		if (plugin.state === 'loaded') {
			await this.unloadPlugin(pluginId);
		}

		// Update version in manifest
		plugin.manifest.version = version;
		plugin.updatedAt = Date.now();
		this.plugins.set(pluginId, plugin);

		this.savePlugins();

		// Reload with new version
		await this.loadPlugin(pluginId);

		this.logService.info(`Plugin ${plugin.manifest.name} updated to ${version}`);

		return plugin;
	}

	// ── Dependencies ─────────────────────────────────────────────────────────

	async checkDependencies(plugin: IPlugin): Promise<IPluginDependency[]> {
		const dependencies: IPluginDependency[] = [];
		const manifest = plugin.manifest;

		if (!manifest.dependencies) {
			return dependencies;
		}

		for (const [depId, versionRange] of Object.entries(manifest.dependencies)) {
			const depPlugin = this.plugins.get(depId);
			dependencies.push({
				pluginId: depId,
				versionRange,
				satisfied: !!depPlugin && depPlugin.state === 'loaded',
			});
		}

		return dependencies;
	}

	async resolveDependencies(plugin: IPlugin): Promise<IPlugin> {
		const dependencies = await this.checkDependencies(plugin);

		for (const dep of dependencies) {
			if (!dep.satisfied) {
				// Try to install missing dependency
				// Real implementation would fetch from marketplace
			}
		}

		return plugin;
	}

	// ── Contributions ────────────────────────────────────────────────────────

	getCommands(): Array<{ id: string; title: string; category?: string }> {
		const commands: Array<{ id: string; title: string; category?: string }> = [];

		for (const [, pluginCommands] of this.pluginCommands) {
			for (const [id, cmd] of pluginCommands) {
				// Get from manifest
			}
		}

		return commands;
	}

	getViews(): Array<{ id: string; name: string; type: string }> {
		const views: Array<{ id: string; name: string; type: string }> = [];

		for (const [, pluginViews] of this.pluginViews) {
			views.push(...pluginViews);
		}

		return views;
	}

	getPanels(): Array<{ id: string; title: string }> {
		const panels: Array<{ id: string; title: string }> = [];

		for (const [, pluginPanels] of this.pluginPanels) {
			panels.push(...pluginPanels);
		}

		return panels;
	}

	getConfiguration(): Record<string, unknown> {
		const config: Record<string, unknown> = {};

		for (const [, pluginConfig] of this.pluginConfiguration) {
			Object.assign(config, pluginConfig);
		}

		return config;
	}

	getMenus(): Array<{ id: string; items: Array<{ command: string }> }> {
		const menus: Array<{ id: string; items: Array<{ command: string }> }> = [];

		for (const [, pluginMenus] of this.pluginMenus) {
			menus.push(...pluginMenus);
		}

		return menus;
	}

	// ── SDK Access ───────────────────────────────────────────────────────────

	getPluginApi<T = unknown>(pluginId: string): T | undefined {
		return this.pluginApis.get(pluginId) as T | undefined;
	}

	registerCommand(
		pluginId: string,
		command: { id: string; title: string; category?: string },
		handler: (...args: unknown[]) => unknown
	): void {
		let commands = this.pluginCommands.get(pluginId);
		if (!commands) {
			commands = new Map();
			this.pluginCommands.set(pluginId, commands);
		}
		commands.set(command.id, { handler });

		this.logService.info(`Command ${command.id} registered by plugin ${pluginId}`);
	}

	registerView(
		pluginId: string,
		view: { id: string; name: string; type: string }
	): void {
		let views = this.pluginViews.get(pluginId);
		if (!views) {
			views = [];
			this.pluginViews.set(pluginId, views);
		}
		views.push(view);

		this.logService.info(`View ${view.id} registered by plugin ${pluginId}`);
	}

	registerPanel(
		pluginId: string,
		panel: { id: string; title: string }
	): void {
		let panels = this.pluginPanels.get(pluginId);
		if (!panels) {
			panels = [];
			this.pluginPanels.set(pluginId, panels);
		}
		panels.push(panel);

		this.logService.info(`Panel ${panel.id} registered by plugin ${pluginId}`);
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private createIsolatedContext(plugin: IPlugin): unknown {
		// Create sandboxed context for plugin execution
		// Real implementation would use Web Workers or iframes

		return {
			pluginId: plugin.id,
			manifest: plugin.manifest,
			// Add sandboxed APIs here
		};
	}

	private registerContributions(plugin: IPlugin): void {
		const manifest = plugin.manifest;

		// Register commands
		if (manifest.contributes?.commands) {
			for (const cmd of manifest.contributes.commands) {
				this.registerCommand(plugin.id, cmd, () => {});
			}
		}

		// Register views
		if (manifest.contributes?.views) {
			for (const view of manifest.contributes.views) {
				this.registerView(plugin.id, view);
			}
		}

		// Register panels
		if (manifest.contributes?.panels) {
			for (const panel of manifest.contributes.panels) {
				this.registerPanel(plugin.id, panel);
			}
		}

		// Register configuration
		if (manifest.contributes?.configuration) {
			this.pluginConfiguration.set(plugin.id, manifest.contributes.configuration);
		}

		// Register menus
		if (manifest.contributes?.menus) {
			this.pluginMenus.set(plugin.id, manifest.contributes.menus);
		}
	}

	private unregisterContributions(pluginId: string): void {
		this.pluginCommands.delete(pluginId);
		this.pluginViews.delete(pluginId);
		this.pluginPanels.delete(pluginId);
		this.pluginConfiguration.delete(pluginId);
		this.pluginMenus.delete(pluginId);
	}

	private updatePluginsState(): void {
		const installed = new Map<string, IPlugin>();
		for (const [id, plugin] of this.plugins) {
			installed.set(id, plugin);
		}

		this.runtimeStateService.update({
			enterprisePlugins: {
				installed,
				marketplace: [],
			},
		});
	}

	private loadPlugins(): void {
		const stored = this.storageService.get('nutanaa.plugins', 0);
		if (stored) {
			try {
				const data = JSON.parse(stored);
				for (const [id, plugin] of Object.entries(data.plugins || {})) {
					this.plugins.set(id, plugin);
				}
			} catch {
				this.plugins = new Map();
			}
		}
	}

	private savePlugins(): void {
		const pluginsObj: Record<string, IPlugin> = {};
		for (const [id, plugin] of this.plugins) {
			pluginsObj[id] = plugin;
		}

		this.storageService.store('nutanaa.plugins', JSON.stringify({ plugins: pluginsObj }), 0);
	}
}
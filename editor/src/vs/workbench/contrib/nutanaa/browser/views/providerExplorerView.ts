/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { append, $, addStandardDisposableListener } from '../../../../base/browser/dom.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { KeybindingService } from '../../../../platform/keybinding/browser/keybindingService.js';
import { ViewPane, ViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { IRuntimeEventBus, RuntimeEventType } from '../../common/runtimeEventBus.js';
import { IRuntimeStateService } from '../../common/runtimeState.js';
import { IProviderExplorerEntry, IProviderModelInfo } from '../../models/studioModel.js';
import { IProviderManager } from '../../common/providerManager.js';
import { IModelRegistry } from '../../common/modelRegistry.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

/**
 * Provider Explorer View for Nutanaa Studio OS.
 *
 * Responsibilities:
 * - Provider list display with health status
 * - Latency monitoring
 * - Capabilities overview
 * - Available models list
 * - Provider switching
 */
export class ProviderExplorerView extends ViewPane {

	private static readonly SELECTED_PROVIDER_KEY = 'nutanaa.selectedProvider';

	private container!: HTMLElement;
	private listContainer!: HTMLElement;
	private detailsContainer!: HTMLElement;

	private providers: IProviderExplorerEntry[] = [];
	private selectedProvider: string | undefined;
	private showDisabled: boolean = false;

	private readonly _register: DisposableStore;

	constructor(
		options: ViewPaneOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IContextViewService contextViewService: IContextViewService,
		@ILogService logService: ILogService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IHoverService hoverService: IHoverService,
		@IKeybindingService keybindingService: KeybindingService,
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IProviderManager private readonly providerManager: IProviderManager,
		@IModelRegistry private readonly modelRegistry: IModelRegistry,
		@IConfigurationService configurationService: IConfigurationService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super(options, instantiationService, contextViewService, configurationService, keybindingService, themeService, storageService, logService, hoverService);

		this._register = new DisposableStore();

		this.loadSelectedProvider();
	}

	protected override renderBody(container: HTMLElement): void {
		this.container = container;
		this.container.classList.add('nutanaa-provider-explorer');

		this.renderToolbar();
		this.renderProvidersList();
		this.renderProviderDetails();

		this.loadProviders();
	}

	private renderToolbar(): void {
		const toolbar = append(this.container, $('.explorer-toolbar'));

		const addButton = append(toolbar, $('button.toolbar-button', {}, '+'));
		addButton.title = localize('addProvider', 'Add Provider');
		this._register(addStandardDisposableListener(addButton, 'click', () => {
			this.showAddProviderDialog();
		}));

		const refreshButton = append(toolbar, $('button.toolbar-button', {}, '↻'));
		refreshButton.title = localize('refresh', 'Refresh');
		this._register(addStandardDisposableListener(refreshButton, 'click', () => {
			this.refreshProviders();
		}));

		const spacer = append(toolbar, $('div.toolbar-spacer'));

		const showDisabledToggle = append(toolbar, $('label.toggle-label'));
		const toggle = append(showDisabledToggle, $('input.toggle-input', { type: 'checkbox' }));
		toggle.checked = this.showDisabled;
		this._register(addStandardDisposableListener(toggle, 'change', () => {
			this.showDisabled = toggle.checked;
			this.renderProvidersList();
		}));
		append(showDisabledToggle, $('span.toggle-label', {}, localize('showDisabled', 'Show Disabled')));
	}

	private renderProvidersList(): void {
		this.listContainer = append(this.container, $('.providers-list'));

		if (this.providers.length === 0) {
			append(this.listContainer, $('div.empty-state', {}, localize('noProviders', 'No providers configured')));
			return;
		}

		for (const provider of this.providers) {
			if (!this.showDisabled && !provider.isEnabled) {
				continue;
			}
			const providerElement = this.createProviderElement(provider);
			this.listContainer.appendChild(providerElement);
		}
	}

	private createProviderElement(provider: IProviderExplorerEntry): HTMLElement {
		const element = append(this.listContainer, $(`.provider-entry${provider.isSelected ? ' selected' : ''}${!provider.isEnabled ? ' disabled' : ''}`, {
			'data-provider-name': provider.name,
		}));

		// Status indicator
		const status = append(element, $('.provider-status'));
		status.className = `provider-status status-${provider.isHealthy ? 'healthy' : 'unhealthy'}`;
		status.title = provider.isHealthy ? localize('healthy', 'Healthy') : localize('unhealthy', 'Unhealthy');

		// Main content
		const content = append(element, $('.provider-content'));

		const header = append(content, $('.provider-header'));

		const name = append(header, $('span.provider-name', {}, provider.name));
		name.title = provider.name;

		const type = append(header, $('span.provider-type', {}, provider.type));

		// Latency
		const latency = append(content, $('span.provider-latency', {}, `${provider.latency}ms`));
		latency.title = localize('latency', 'Latency');

		// Model
		const model = append(content, $('span.provider-model', {}, provider.model));

		// Capabilities badges
		const capabilities = append(element, $('.provider-capabilities'));

		if (provider.capabilities.streaming) {
			append(capabilities, $('span.capability-badge', {}, 'Stream'));
		}
		if (provider.capabilities.functionCalling) {
			append(capabilities, $('span.capability-badge', {}, 'FC'));
		}
		if (provider.capabilities.vision) {
			append(capabilities, $('span.capability-badge', {}, 'Vision'));
		}

		this._register(addStandardDisposableListener(element, 'click', () => {
			this.selectProvider(provider.name);
		}));

		return element;
	}

	private renderProviderDetails(): void {
		this.detailsContainer = append(this.container, $('.provider-details'));

		const selected = this.providers.find(p => p.name === this.selectedProvider);

		if (!selected) {
			append(this.detailsContainer, $('div.no-selection', {}, localize('selectProvider', 'Select a provider to view details')));
			return;
		}

		// Header
		const header = append(this.detailsContainer, $('.details-header'));

		const name = append(header, $('h3.provider-name', {}, selected.name));
		name.title = selected.name;

		const type = append(header, $('span.provider-type-badge', {}, selected.type));

		// Health status
		const status = append(this.detailsContainer, $('.details-section'));
		append(status, $('h4', {}, localize('health', 'Health')));

		const healthGrid = append(status, $('.details-grid'));

		const healthItem = append(healthGrid, $('.details-item'));
		append(healthItem, $('span.item-label', {}, localize('status', 'Status')));
		append(healthItem, $('span.item-value', {}, selected.isHealthy ? localize('healthy', 'Healthy') : localize('unhealthy', 'Unhealthy')));

		const latencyItem = append(healthGrid, $('.details-item'));
		append(latencyItem, $('span.item-label', {}, localize('latency', 'Latency')));
		append(latencyItem, $('span.item-value', {}, `${selected.latency}ms`));

		// Connection
		const connection = append(this.detailsContainer, $('.details-section'));
		append(connection, $('h4', {}, localize('connection', 'Connection')));

		const connectionItem = append(connection, $('.details-item'));
		append(connectionItem, $('span.item-label', {}, 'URL'));
		append(connectionItem, $('span.item-value.url', {}, selected.baseUrl));

		// Current model
		const model = append(this.detailsContainer, $('.details-section'));
		append(model, $('h4', {}, localize('model', 'Model')));

		const modelItem = append(model, $('.details-item'));
		append(modelItem, $('span.item-label', {}, localize('current', 'Current')));
		append(modelItem, $('span.item-value', {}, selected.model));

		// Capabilities
		const capabilities = append(this.detailsContainer, $('.details-section'));
		append(capabilities, $('h4', {}, localize('capabilities', 'Capabilities')));

		const capsGrid = append(capabilities, $('.capabilities-grid'));

		const caps: Array<{ key: string; label: string; value: boolean }> = [
			{ key: 'streaming', label: 'Streaming', value: selected.capabilities.streaming },
			{ key: 'functionCalling', label: 'Function Calling', value: selected.capabilities.functionCalling },
			{ key: 'vision', label: 'Vision', value: selected.capabilities.vision },
			{ key: 'audio', label: 'Audio', value: selected.capabilities.audio },
			{ key: 'embedding', label: 'Embedding', value: selected.capabilities.embedding },
			{ key: 'reasoning', label: 'Reasoning', value: selected.capabilities.reasoning },
		];

		for (const cap of caps) {
			const capItem = append(capsGrid, $(`.capability-item${cap.value ? ' enabled' : ' disabled'}`));
			capItem.textContent = `${cap.label}: ${cap.value ? '✓' : '✗'}`;
		}

		// Models
		if (selected.models.length > 0) {
			const modelsSection = append(this.detailsContainer, $('.details-section'));
			append(modelsSection, $('h4', {}, localize('availableModels', 'Available Models')));

			const modelsList = append(modelsSection, $('.models-list'));

			for (const model of selected.models) {
				const modelItem = append(modelsList, $(`.model-item${model.available ? '' : ' unavailable'}`));
				append(modelItem, $('span.model-name', {}, model.name));
				append(modelItem, $('span.model-info', {}, `${model.contextLength.toLocaleString()} ctx / ${model.maxOutputTokens.toLocaleString()} out`));
			}
		}

		// Actions
		const actions = append(this.detailsContainer, $('.details-actions'));

		if (!selected.isSelected) {
			const selectButton = append(actions, $('button.action-button.primary', {}, localize('select', 'Select')));
			this._register(addStandardDisposableListener(selectButton, 'click', () => {
				this.selectProvider(selected.name);
			}));
		}

		const toggleButton = append(actions, $('button.action-button', {}, selected.isEnabled ? localize('disable', 'Disable') : localize('enable', 'Enable')));
		this._register(addStandardDisposableListener(toggleButton, 'click', () => {
			this.toggleProvider(selected.name);
		}));

		const editButton = append(actions, $('button.action-button', {}, localize('edit', 'Edit')));
		this._register(addStandardDisposableListener(editButton, 'click', () => {
			this.editProvider(selected.name);
		}));

		const deleteButton = append(actions, $('button.action-button.danger', {}, localize('delete', 'Delete')));
		this._register(addStandardDisposableListener(deleteButton, 'click', () => {
			this.deleteProvider(selected.name);
		}));
	}

	private loadProviders(): void {
		const allProviders = this.providerManager.getAllProviders();

		this.providers = allProviders.map(status => ({
			name: status.config.name,
			type: status.config.type,
			baseUrl: status.config.baseUrl,
			model: status.config.model,
			isHealthy: status.health.isHealthy,
			latencyMs: status.health.latencyMs,
			capabilities: {
				streaming: status.config.capabilities.supportsStreaming,
				functionCalling: status.config.capabilities.supportsFunctionCalling,
				vision: status.config.capabilities.supportsVision,
				audio: status.config.capabilities.supportsAudio,
				embedding: status.config.capabilities.supportsEmbedding,
				reasoning: status.config.capabilities.supportsReasoning,
			},
			models: [],
			isSelected: status.isSelected,
			isEnabled: status.config.enabled,
		}));

		this.renderProvidersList();
		this.renderProviderDetails();
	}

	private loadSelectedProvider(): void {
		const stored = this.storageService.get(ProviderExplorerView.SELECTED_PROVIDER_KEY, 0);
		if (stored) {
			this.selectedProvider = stored;
		}
	}

	private selectProvider(providerName: string): void {
		const success = this.providerManager.selectProviderByName(providerName);
		if (success) {
			this.selectedProvider = providerName;
			this.storageService.store(ProviderExplorerView.SELECTED_PROVIDER_KEY, providerName, 0);

			this.loadProviders();
			this.runtimeEventBus.fire({
				type: RuntimeEventType.ProviderChanged,
				timestamp: Date.now(),
				payload: { name: providerName, previousStatus: 'not_selected', newStatus: 'selected' },
			});
		}
	}

	private toggleProvider(providerName: string): void {
		const provider = this.providers.find(p => p.name === providerName);
		if (provider) {
			this.providerManager.updateProvider(providerName, { enabled: !provider.isEnabled });
			this.loadProviders();
		}
	}

	private editProvider(providerName: string): void {
		// TODO: Open provider edit dialog
	}

	private deleteProvider(providerName: string): void {
		if (confirm(localize('confirmDeleteProvider', 'Are you sure you want to delete provider {0}?', providerName))) {
			this.providerManager.unregisterProvider(providerName);
			if (this.selectedProvider === providerName) {
				this.selectedProvider = undefined;
			}
			this.loadProviders();
		}
	}

	private showAddProviderDialog(): void {
		// TODO: Open add provider dialog
	}

	private refreshProviders(): void {
		this.providerManager.refreshAllHealth().then(() => {
			this.loadProviders();
		});
	}

	public override dispose(): void {
		this._register.dispose();
		super.dispose();
	}
}

import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
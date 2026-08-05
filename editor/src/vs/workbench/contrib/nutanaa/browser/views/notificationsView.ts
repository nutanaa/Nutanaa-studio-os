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
import { INotification, INotificationAction, INotificationSettings, NotificationType } from '../../models/studioModel.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

/**
 * Notifications Center View for Nutanaa Studio OS.
 *
 * Responsibilities:
 * - Display errors, warnings, success messages, info
 * - Execution complete notifications
 * - Provider and model change notifications
 * - Dismiss functionality
 * - Notification history
 */
export class NotificationsView extends ViewPane {

	private static readonly NOTIFICATIONS_STORE_KEY = 'nutanaa.notifications';
	private static readonly SETTINGS_STORE_KEY = 'nutanaa.notifications.settings';
	private static readonly MAX_NOTIFICATIONS = 100;

	private container!: HTMLElement;
	private filterContainer!: HTMLElement;
	private listContainer!: HTMLElement;
	private settingsContainer!: HTMLElement;

	private notifications: INotification[] = [];
	private settings: INotificationSettings = {
		showErrors: true,
		showWarnings: true,
		showSuccess: true,
		showInfo: true,
		maxVisible: 10,
		autoDismissDelay: 5000,
	};

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
		@IConfigurationService configurationService: IConfigurationService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super(options, instantiationService, contextViewService, configurationService, keybindingService, themeService, storageService, logService, hoverService);

		this._register = new DisposableStore();

		this.loadNotifications();
		this.loadSettings();
		this.setupEventListeners();
	}

	protected override renderBody(container: HTMLElement): void {
		this.container = container;
		this.container.classList.add('nutanaa-notifications');

		this.renderFilterBar();
		this.renderNotificationsList();
		this.renderSettings();
	}

	private renderFilterBar(): void {
		this.filterContainer = append(this.container, $('.notification-filter'));

		const types: Array<{ type: NotificationType; icon: string }> = [
			{ type: 'error', icon: '❌' },
			{ type: 'warning', icon: '⚠️' },
			{ type: 'success', icon: '✅' },
			{ type: 'info', icon: 'ℹ️' },
		];

		for (const type of types) {
			const button = append(this.filterContainer, $(`.filter-toggle${this.isTypeVisible(type.type) ? ' active' : ''}`));
			button.title = type.type;
			button.innerHTML = type.icon;
			button.dataset.type = type.type;

			this._register(addStandardDisposableListener(button, 'click', () => {
				this.toggleTypeVisibility(type.type);
			}));
		}

		const spacer = append(this.filterContainer, $('div.filter-spacer'));

		const clearButton = append(this.filterContainer, $('button.clear-button', {}, '🗑'));
		clearButton.title = localize('clearAll', 'Clear All');
		this._register(addStandardDisposableListener(clearButton, 'click', () => {
			this.clearAllNotifications();
		}));

		const settingsButton = append(this.filterContainer, $('button.settings-button', {}, '⚙️'));
		settingsButton.title = localize('settings', 'Settings');
		this._register(addStandardDisposableListener(settingsButton, 'click', () => {
			this.toggleSettings();
		}));
	}

	private renderNotificationsList(): void {
		this.listContainer = append(this.container, $('.notifications-list'));

		this.renderNotifications();
	}

	private renderNotifications(): void {
		const visible = this.getVisibleNotifications();

		if (visible.length === 0) {
			this.listContainer.innerHTML = '';
			append(this.listContainer, $('div.empty-state', {}, localize('noNotifications', 'No notifications')));
			return;
		}

		const fragment = document.createDocumentFragment();

		for (const notification of visible) {
			const notificationElement = this.createNotificationElement(notification);
			fragment.appendChild(notificationElement);
		}

		this.listContainer.innerHTML = '';
		this.listContainer.appendChild(fragment);
	}

	private createNotificationElement(notification: INotification): HTMLElement {
		const element = append(this.listContainer, $(`.notification-entry type-${notification.type}`, {
			'notification-id': notification.id,
		}));

		// Icon
		const icon = append(element, $('span.notification-icon', {}, this.getTypeIcon(notification.type)));
		icon.title = notification.type;

		// Content
		const content = append(element, $('.notification-content'));

		const header = append(content, $('.notification-header'));

		const title = append(header, $('span.notification-title', {}, notification.title));
		title.title = notification.title;

		const time = append(header, $('span.notification-time', {}, this.formatTime(notification.timestamp)));

		const message = append(content, $('span.notification-message', {}, notification.message));
		message.title = notification.message;

		// Source
		if (notification.source) {
			const source = append(content, $('span.notification-source', {}, notification.source));
			source.title = notification.source;
		}

		// Actions
		if (notification.actions && notification.actions.length > 0) {
			const actions = append(content, $('.notification-actions'));
			for (const action of notification.actions) {
				const actionButton = append(actions, $(`button.action-button${action.primary ? ' primary' : ''}`, {}, action.label));
				this._register(addStandardDisposableListener(actionButton, 'click', () => {
					this.executeAction(notification, action);
				}));
			}
		}

		// Dismiss button
		if (notification.dismissible) {
			const dismissButton = append(element, $('button.dismiss-button', {}, '×'));
			dismissButton.title = localize('dismiss', 'Dismiss');
			this._register(addStandardDisposableListener(dismissButton, 'click', () => {
				this.dismissNotification(notification.id);
			}));
		}

		return element;
	}

	private renderSettings(): void {
		this.settingsContainer = append(this.container, $('.notification-settings'));
		this.settingsContainer.style.display = 'none';

		append(this.settingsContainer, $('h4', {}, localize('settings', 'Settings')));

		// Error toggle
		const errorToggle = this.createSettingToggle('showErrors', localize('showErrors', 'Show Errors'));
		this.settingsContainer.appendChild(errorToggle);

		// Warning toggle
		const warningToggle = this.createSettingToggle('showWarnings', localize('showWarnings', 'Show Warnings'));
		this.settingsContainer.appendChild(warningToggle);

		// Success toggle
		const successToggle = this.createSettingToggle('showSuccess', localize('showSuccess', 'Show Success'));
		this.settingsContainer.appendChild(successToggle);

		// Info toggle
		const infoToggle = this.createSettingToggle('showInfo', localize('showInfo', 'Show Info'));
		this.settingsContainer.appendChild(infoToggle);
	}

	private createSettingToggle(key: keyof INotificationSettings, label: string): HTMLElement {
		const container = append(this.settingsContainer, $('label.settings-toggle'));

		const toggle = append(container, $('input.toggle-input', { type: 'checkbox', checked: this.settings[key] as boolean }));
		this._register(addStandardDisposableListener(toggle, 'change', () => {
			(this.settings as Record<string, boolean>)[key] = toggle.checked;
			this.saveSettings();
			this.renderNotifications();
		}));

		append(container, $('span.toggle-label', {}, label));

		return container;
	}

	private getVisibleNotifications(): INotification[] {
		return this.notifications.filter(n => {
			const isVisible = (n.type === 'error' && this.settings.showErrors) ||
				(n.type === 'warning' && this.settings.showWarnings) ||
				(n.type === 'success' && this.settings.showSuccess) ||
				(n.type === 'info' && this.settings.showInfo);

			return isVisible && !n.dismissedOnce;
		}).slice(0, this.settings.maxVisible);
	}

	private isTypeVisible(type: NotificationType): boolean {
		switch (type) {
			case 'error': return this.settings.showErrors;
			case 'warning': return this.settings.showWarnings;
			case 'success': return this.settings.showSuccess;
			case 'info': return this.settings.showInfo;
			default: return true;
		}
	}

	private toggleTypeVisibility(type: NotificationType): void {
		switch (type) {
			case 'error': this.settings.showErrors = !this.settings.showErrors; break;
			case 'warning': this.settings.showWarnings = !this.settings.showWarnings; break;
			case 'success': this.settings.showSuccess = !this.settings.showSuccess; break;
			case 'info': this.settings.showInfo = !this.settings.showInfo; break;
		}

		this.updateFilterButtons();
		this.saveSettings();
		this.renderNotifications();
	}

	private updateFilterButtons(): void {
		const buttons = this.filterContainer.querySelectorAll('.filter-toggle');
		buttons.forEach(btn => {
			const type = btn.dataset.type as NotificationType;
			btn.classList.toggle('active', this.isTypeVisible(type));
		});
	}

	private getTypeIcon(type: NotificationType): string {
		switch (type) {
			case 'error': return '❌';
			case 'warning': return '⚠️';
			case 'success': return '✅';
			case 'info': return 'ℹ️';
			default: return '●';
		}
	}

	private formatTime(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	private loadNotifications(): void {
		const stored = this.storageService.get(NotificationsView.NOTIFICATIONS_STORE_KEY, 0);
		if (stored) {
			try {
				this.notifications = JSON.parse(stored);
			} catch {
				this.notifications = [];
			}
		}
	}

	private saveNotifications(): void {
		if (this.notifications.length > NotificationsView.MAX_NOTIFICATIONS) {
			this.notifications = this.notifications.slice(-NotificationsView.MAX_NOTIFICATIONS);
		}
		this.storageService.store(NotificationsView.NOTIFICATIONS_STORE_KEY, JSON.stringify(this.notifications), 0);
	}

	private loadSettings(): void {
		const stored = this.storageService.get(NotificationsView.SETTINGS_STORE_KEY, 0);
		if (stored) {
			try {
				this.settings = { ...this.settings, ...JSON.parse(stored) };
			} catch {
				// Use default
			}
		}
	}

	private saveSettings(): void {
		this.storageService.store(NotificationsView.SETTINGS_STORE_KEY, JSON.stringify(this.settings), 0);
	}

	private setupEventListeners(): void {
		// Subscribe to runtime events
		this._register(this.runtimeEventBus.on(RuntimeEventType.RuntimeError, (event) => {
			this.addNotification({
				type: 'error',
				title: 'Error',
				message: event.payload?.message || 'An error occurred',
				source: event.payload?.source || 'runtime',
				dismissible: true,
				dismissibleOnce: false,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.RuntimeWarning, (event) => {
			this.addNotification({
				type: 'warning',
				title: 'Warning',
				message: event.payload?.message || 'A warning occurred',
				source: event.payload?.source || 'runtime',
				dismissible: true,
				dismissibleOnce: false,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.RuntimeInfo, (event) => {
			this.addNotification({
				type: 'info',
				title: 'Info',
				message: event.payload?.message || 'Information',
				source: event.payload?.source || 'runtime',
				dismissible: true,
				dismissibleOnce: false,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.AgentCompleted, (event) => {
			this.addNotification({
				type: 'success',
				title: 'Agent Completed',
				message: `Agent ${event.payload?.agentId} completed successfully`,
				source: 'agent',
				dismissible: true,
				dismissibleOnce: false,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.AgentFailed, (event) => {
			this.addNotification({
				type: 'error',
				title: 'Agent Failed',
				message: event.payload?.error || 'Agent failed',
				source: 'agent',
				dismissible: true,
				dismissibleOnce: false,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.ProviderChanged, (event) => {
			this.addNotification({
				type: 'info',
				title: 'Provider Changed',
				message: `Provider changed to ${event.payload?.name}`,
				source: 'provider',
				dismissible: true,
				dismissibleOnce: true,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.WorkflowCompleted, (event) => {
			this.addNotification({
				type: 'success',
				title: 'Workflow Completed',
				message: `Workflow completed successfully`,
				source: 'workflow',
				dismissible: true,
				dismissibleOnce: false,
			});
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.ToolCompleted, (event) => {
			this.addNotification({
				type: 'success',
				title: 'Tool Completed',
				message: `Tool ${event.payload?.toolName} completed`,
				source: 'tool',
				dismissible: true,
				dismissibleOnce: true,
			});
		}));
	}

	private addNotification(notification: Omit<INotification, 'id' | 'timestamp'>): void {
		const newNotification: INotification = {
			...notification,
			id: `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			timestamp: Date.now(),
		};

		this.notifications.unshift(newNotification);
		this.saveNotifications();

		// Only show if type is visible
		if (this.isTypeVisible(newNotification.type)) {
			this.renderNotifications();
		}

		// Auto-dismiss after delay if configured
		if (newNotification.dismissible && newNotification.dismissibleOnce) {
			setTimeout(() => {
				this.dismissNotification(newNotification.id);
			}, this.settings.autoDismissDelay);
		}
	}

	private dismissNotification(notificationId: string): void {
		const notification = this.notifications.find(n => n.id === notificationId);
		if (notification) {
			if (notification.dismissibleOnce) {
				notification.dismissedOnce = true;
			} else {
				notification.dismissible = false;
			}
			this.saveNotifications();
			this.renderNotifications();
		}
	}

	private clearAllNotifications(): void {
		if (confirm(localize('confirmClearNotifications', 'Are you sure you want to clear all notifications?'))) {
			this.notifications = [];
			this.saveNotifications();
			this.renderNotifications();
		}
	}

	private toggleSettings(): void {
		const isVisible = this.settingsContainer.style.display !== 'none';
		this.settingsContainer.style.display = isVisible ? 'none' : 'block';
	}

	private executeAction(notification: INotification, action: INotificationAction): void {
		// TODO: Execute notification action
		this.dismissNotification(notification.id);
	}

	public override dispose(): void {
		this.saveNotifications();
		this._register.dispose();
		super.dispose();
	}
}

import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
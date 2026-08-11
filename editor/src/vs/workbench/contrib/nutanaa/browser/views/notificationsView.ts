/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { append, $, clearNode, addStandardDisposableListener } from '../../../../../base/browser/dom.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService } from '../../../../common/views.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { FilterViewPane, IFilterViewPaneOptions } from '../../../../browser/parts/views/viewPane.js';
import { IRuntimeEventBus } from '../../common/runtime/runtimeEventBus.js';
import { RuntimeEventType, RuntimeEvent, AgentEvent, ProviderEvent, WorkflowEvent, LogEvent } from '../../common/runtime/runtimeEvents.js';
import { INotification, INotificationAction, INotificationSettings, NotificationType } from '../../models/studioModel.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';

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
export class NotificationsView extends FilterViewPane {

	private static readonly NOTIFICATIONS_STORE_KEY = 'nutanaa.notifications';
	private static readonly SETTINGS_STORE_KEY = 'nutanaa.notifications.settings';
	private static readonly MAX_NOTIFICATIONS = 100;

	private container!: HTMLElement;
	private notificationsFilterContainer!: HTMLElement;
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
	private autoDismissTimers: ReturnType<typeof setTimeout>[] = [];

	constructor(
		options: IFilterViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService logService: ILogService,
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this.loadNotifications();
		this.loadSettings();
		this.setupEventListeners();
	}

	protected override renderBody(container: HTMLElement): void {
		this.container = container;
	}

	protected layoutBodyContent(height: number, width: number): void {
		this.container.classList.add('nutanaa-notifications');

		this.renderFilterBar();
		this.renderNotificationsList();
		this.renderSettings();
	}

	private renderFilterBar(): void {
		this.notificationsFilterContainer = append(this.container, $('.notification-filter'));

		const types: Array<{ type: NotificationType; icon: string }> = [
			{ type: 'error', icon: '❌' },
			{ type: 'warning', icon: '⚠️' },
			{ type: 'success', icon: '✅' },
			{ type: 'info', icon: 'ℹ️' },
		];

		for (const type of types) {
			const button = append(this.notificationsFilterContainer, $(`.filter-toggle${this.isTypeVisible(type.type) ? ' active' : ''}`));
			button.title = type.type;
			button.textContent = type.icon;
			(button as HTMLElement).dataset.type = type.type;

			this._register(addStandardDisposableListener(button as HTMLElement, 'click', () => {
				this.toggleTypeVisibility(type.type);
			}));
		}

		const clearButton = append(this.notificationsFilterContainer, $('button.clear-button', {}, '🗑'));
		clearButton.title = localize('clearAll', 'Clear All');
		this._register(addStandardDisposableListener(clearButton as HTMLElement, 'click', () => {
			this.clearAllNotifications();
		}));

		const settingsButton = append(this.notificationsFilterContainer, $('button.settings-button', {}, '⚙️'));
		settingsButton.title = localize('settings', 'Settings');
		this._register(addStandardDisposableListener(settingsButton as HTMLElement, 'click', () => {
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
			clearNode(this.listContainer);
			append(this.listContainer, $('div.empty-state', {}, localize('noNotifications', 'No notifications')));
			return;
		}

		const fragment = document.createDocumentFragment();

		for (const notification of visible) {
			const notificationElement = this.createNotificationElement(notification);
			fragment.appendChild(notificationElement);
		}

		clearNode(this.listContainer);
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
				this._register(addStandardDisposableListener(actionButton as HTMLElement, 'click', () => {
					this.executeAction(notification, action);
				}));
			}
		}

		// Dismiss button
		if (notification.dismissible) {
			const dismissButton = append(element, $('button.dismiss-button', {}, '×'));
			dismissButton.title = localize('dismiss', 'Dismiss');
			this._register(addStandardDisposableListener(dismissButton as HTMLElement, 'click', () => {
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
		this._register(addStandardDisposableListener(toggle as HTMLElement, 'change', () => {
			const updatedSettings = { ...this.settings, [key]: (toggle as HTMLInputElement).checked };
			this.settings = updatedSettings as INotificationSettings;
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

			return isVisible && !n.dismissibleOnce;
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
			case 'error': { const current = this.settings.showErrors; this.settings = { ...this.settings, showErrors: !current }; break; }
			case 'warning': { const current = this.settings.showWarnings; this.settings = { ...this.settings, showWarnings: !current }; break; }
			case 'success': { const current = this.settings.showSuccess; this.settings = { ...this.settings, showSuccess: !current }; break; }
			case 'info': { const current = this.settings.showInfo; this.settings = { ...this.settings, showInfo: !current }; break; }
		}

		this.updateFilterButtons();
		this.saveSettings();
		this.renderNotifications();
	}

	private updateFilterButtons(): void {
		const buttons = this.notificationsFilterContainer.querySelectorAll('.filter-toggle');
		buttons.forEach(btn => {
			const type = (btn as HTMLElement).dataset.type as NotificationType;
			(btn as HTMLElement).classList.toggle('active', this.isTypeVisible(type));
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


	private loadNotifications(): void {
		const stored = this.storageService.get(NotificationsView.NOTIFICATIONS_STORE_KEY, StorageScope.APPLICATION);
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
		this.storageService.store(NotificationsView.NOTIFICATIONS_STORE_KEY, JSON.stringify(this.notifications), StorageScope.APPLICATION, StorageTarget.USER);
	}

	private loadSettings(): void {
		const stored = this.storageService.get(NotificationsView.SETTINGS_STORE_KEY, StorageScope.APPLICATION);
		if (stored) {
			try {
				this.settings = { ...this.settings, ...JSON.parse(stored) };
			} catch {
				// Use default
			}
		}
	}

	private saveSettings(): void {
		this.storageService.store(NotificationsView.SETTINGS_STORE_KEY, JSON.stringify(this.settings), StorageScope.APPLICATION, StorageTarget.USER);
	}

	private setupEventListeners(): void {
		this._register(this.runtimeEventBus.on<LogEvent>(RuntimeEventType.Error, (event: RuntimeEvent<LogEvent>) => {
			this.addNotification({
				type: 'error',
				title: 'Error',
				message: event.payload.message,
				source: event.payload.source || 'runtime',
				dismissible: true,
				dismissibleOnce: false,
			});
		}));

		this._register(this.runtimeEventBus.on<LogEvent>(RuntimeEventType.Warning, (event: RuntimeEvent<LogEvent>) => {
			this.addNotification({
				type: 'warning',
				title: 'Warning',
				message: event.payload.message,
				source: event.payload.source || 'runtime',
				dismissible: true,
				dismissibleOnce: false,
			});
		}));

		this._register(this.runtimeEventBus.on<LogEvent>(RuntimeEventType.Log, (event: RuntimeEvent<LogEvent>) => {
			this.addNotification({
				type: 'info',
				title: 'Info',
				message: event.payload.message,
				source: event.payload.source || 'runtime',
				dismissible: true,
				dismissibleOnce: false,
			});
		}));

		this._register(this.runtimeEventBus.on<AgentEvent>(RuntimeEventType.AgentCompleted, (event: RuntimeEvent<AgentEvent>) => {
			this.addNotification({
				type: 'success',
				title: 'Agent Completed',
				message: `Agent ${event.payload.id} completed successfully`,
				source: 'agent',
				dismissible: true,
				dismissibleOnce: false,
			});
		}));

		this._register(this.runtimeEventBus.on<AgentEvent>(RuntimeEventType.AgentFailed, (event: RuntimeEvent<AgentEvent>) => {
			this.addNotification({
				type: 'error',
				title: 'Agent Failed',
				message: event.payload.message || 'Agent failed',
				source: 'agent',
				dismissible: true,
				dismissibleOnce: false,
			});
		}));

		this._register(this.runtimeEventBus.on<ProviderEvent>(RuntimeEventType.ProviderChanged, (event: RuntimeEvent<ProviderEvent>) => {
			this.addNotification({
				type: 'info',
				title: 'Provider Changed',
				message: `Provider changed to ${event.payload.name}`,
				source: 'provider',
				dismissible: true,
				dismissibleOnce: true,
			});
		}));

		this._register(this.runtimeEventBus.on<WorkflowEvent>(RuntimeEventType.WorkflowCompleted, (event: RuntimeEvent<WorkflowEvent>) => {
			this.addNotification({
				type: 'success',
				title: 'Workflow Completed',
				message: `Workflow completed successfully`,
				source: 'workflow',
				dismissible: true,
				dismissibleOnce: false,
			});
		}));

		this._register(this.runtimeEventBus.on<unknown>(RuntimeEventType.ToolCompleted, (event: RuntimeEvent<unknown>) => {
			this.addNotification({
				type: 'success',
				title: 'Tool Completed',
				message: `Tool ${(event.payload as { title?: string })?.title || 'unknown'} completed`,
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
			const timer = setTimeout(() => {
				this.dismissNotification(newNotification.id);
			}, this.settings.autoDismissDelay);
			this.autoDismissTimers.push(timer);
		}
	}

	private dismissNotification(notificationId: string): void {
		const notificationIndex = this.notifications.findIndex(n => n.id === notificationId);
		if (notificationIndex >= 0) {
			const notification = this.notifications[notificationIndex];
			if (notification.dismissibleOnce) {
				const updatedNotification = { ...notification, dismissibleOnce: !notification.dismissibleOnce };
				this.notifications[notificationIndex] = updatedNotification;
			} else {
				const updatedNotification = { ...notification, dismissible: false };
				this.notifications[notificationIndex] = updatedNotification;
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
		for (const timer of this.autoDismissTimers) {
			clearTimeout(timer);
		}
		this.autoDismissTimers = [];
		this.saveNotifications();
		super.dispose();
	}
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../../base/common/event.js';
import { IDisposable } from '../../../../../base/common/lifecycle.js';
import { append, $, addStandardDisposableListener, getTotalHeight, clearNode } from '../../../../../base/browser/dom.js';
import { createStyleSheet } from '../../../../../base/browser/domStylesheets.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
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
import { RuntimeEventType } from '../../common/runtime/runtimeEvents.js';
import { AgentEvent, AgentStreamEvent, RuntimeEvent } from '../../common/runtime/runtimeEvent.js';
import { IRuntimeCoordinator } from '../../common/runtime/runtimeCoordinator.js';
import { IChatMessage, IChatAttachment } from '../../models/studioModel.js';
import { IAgentExecutionRequest } from '../../models/executionModel.js';
import { localize } from '../../../../../nls.js';
import { renderMarkdown } from '../../../../../base/browser/markdownRenderer.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';

interface ChatViewState {
	readonly messages: IChatMessage[];
	readonly inputText: string;
	readonly isGenerating: boolean;
	readonly attachments: IChatAttachment[];
	readonly contextChips: readonly string[];
	readonly selectedMode: string;
	readonly selectedProvider: string | undefined;
	readonly selectedModel: string | undefined;
}

type ChatMode = 'chat' | 'agent' | 'plan' | 'ask' | 'debug' | 'review';

const CHAT_MODES: readonly { id: ChatMode; label: string }[] = [
	{ id: 'chat', label: 'Chat' },
	{ id: 'agent', label: 'Agent' },
	{ id: 'plan', label: 'Plan' },
	{ id: 'ask', label: 'Ask' },
	{ id: 'debug', label: 'Debug' },
	{ id: 'review', label: 'Review' },
];

interface MockProvider {
	readonly id: string;
	readonly name: string;
	readonly models: readonly string[];
}

const MOCK_PROVIDERS: readonly MockProvider[] = [
	{ id: 'ollama', name: 'Ollama', models: ['llama3.2', 'qwen3', 'codegemma'] },
	{ id: 'openai', name: 'OpenAI', models: ['GPT-5', 'GPT-5-mini'] },
	{ id: 'anthropic', name: 'Anthropic', models: ['Claude Sonnet'] },
];

const MOCK_SHORTCUTS: readonly { readonly title: string; readonly prompt: string }[] = [
	{ title: 'Explain this project', prompt: 'Explain this project' },
	{ title: 'Find a bug', prompt: 'Find a bug in my codebase' },
	{ title: 'Refactor code', prompt: 'Refactor code' },
	{ title: 'Add a feature', prompt: 'Add a feature' },
];

const MOCK_CONTEXT_OPTIONS: readonly { readonly id: string; readonly label: string }[] = [
	{ id: 'file', label: '@file' },
	{ id: 'folder', label: '@folder' },
	{ id: 'selection', label: '@selection' },
	{ id: 'workspace', label: '@workspace' },
	{ id: 'codebase', label: '@codebase' },
];

/**
 * AI Chat Panel for Nutanaa Studio OS.
 *
 * Responsibilities:
 * - Streaming chat interface
 * - Conversation history
 * - Markdown and code block rendering
 * - Tool call visualization
 * - Multi-agent conversation
 * - Retry, stop, continue generation
 * - Prompt history
 * - File/image attachments
 * - Drag & drop support
 * - Token counter
 * - Model/provider selector
 * - Conversation export
 */
export class ChatView extends FilterViewPane {

	private static readonly MESSAGES_STORE_KEY = 'nutanaa.chat.messages';
	private static readonly INPUT_STORE_KEY = 'nutanaa.chat.input';
	private static readonly MODE_STORE_KEY = 'nutanaa.chat.mode';

	private readonly _onDidChangeContentHeight = this._register(new Emitter<number>());
	public readonly onDidChangeContentHeight = this._onDidChangeContentHeight.event;

	private container!: HTMLElement;
	private messagesContainer!: HTMLElement;
	private emptyStateContainer!: HTMLElement;
	private composerContainer!: HTMLElement;
	private inputElement!: HTMLTextAreaElement;
	private sendButton!: HTMLElement;
	private stopButton!: HTMLElement;
	private attachmentButton!: HTMLElement;
	private contextButton!: HTMLElement;
	private tokenCounter!: HTMLElement;
	private modeSelector!: HTMLElement;
	private providerSelector!: HTMLElement;
	private modelSelector!: HTMLElement;
	private scrollContainer!: HTMLElement;
	private thinkingIndicator!: HTMLElement | undefined;
	private contextChipsContainer!: HTMLElement | undefined;
	private contextMenuPopover!: HTMLElement | undefined;
	private contextMenuDisposer: IDisposable | undefined;
	private attachmentInput!: HTMLInputElement | undefined;
	private bottomControlsContainer!: HTMLElement;

	private currentExecution: { abortController: AbortController; messageId: string } | undefined;
	private pendingMessages: Map<string, IChatMessage> = new Map();
	private streamingMessageId: string | undefined;
	private markdownRenderer: typeof renderMarkdown;

	private state: ChatViewState = {
		messages: [],
		inputText: '',
		isGenerating: false,
		attachments: [],
		contextChips: [],
		selectedMode: 'chat',
		selectedProvider: undefined,
		selectedModel: undefined,
	};

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
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeCoordinator private readonly runtimeCoordinator: IRuntimeCoordinator,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this.markdownRenderer = renderMarkdown;
		this.createChatStyles();
		this.loadPersistedState();
		this.setupEventListeners();
	}

	private createChatStyles(): void {
		const style = createStyleSheet();
		style.textContent = `
			.nutanaa-chat {
				display: flex;
				flex-direction: column;
				height: 100%;
				background: var(--vscode-editor-background);
				color: var(--vscode-foreground);
				font-family: var(--vscode-font-family);
				font-size: var(--vscode-font-size);
				line-height: 1.5;
				overflow: hidden;
			}

			.nutanaa-chat .chat-header {
				display: flex;
				align-items: center;
				gap: 8px;
				padding: 8px 12px;
				border-bottom: 1px solid var(--vscode-editorWidget-border, #454545);
				background: var(--vscode-sideBar-background);
				flex-shrink: 0;
			}

			.nutanaa-chat .chat-title {
				font-size: 13px;
				font-weight: 600;
				color: var(--vscode-foreground);
				margin-right: auto;
			}

			.nutanaa-chat .chat-selector {
				background: var(--vscode-dropdown-background);
				color: var(--vscode-dropdown-foreground);
				border: 1px solid var(--vscode-dropdown-border);
				border-radius: 4px;
				padding: 3px 8px;
				font-size: 12px;
				cursor: pointer;
				outline: none;
				min-width: 80px;
			}

			.nutanaa-chat .chat-selector:focus {
				border-color: var(--vscode-focusBorder, #007fd4);
			}

			.nutanaa-chat .chat-action {
				background: transparent;
				color: var(--vscode-foreground);
				border: none;
				padding: 4px 8px;
				border-radius: 4px;
				cursor: pointer;
				font-size: 12px;
				display: flex;
				align-items: center;
				gap: 4px;
			}

			.nutanaa-chat .chat-action:hover {
				background: var(--vscode-toolbar-hoverBackground);
			}

			.nutanaa-chat .messages-container {
				flex: 1;
				overflow-y: auto;
				overflow-x: hidden;
				padding: 12px;
				display: flex;
				flex-direction: column;
				gap: 12px;
			}

			.nutanaa-chat .message {
				display: flex;
				flex-direction: column;
				gap: 4px;
				max-width: 100%;
			}

			.nutanaa-chat .message-user {
				align-items: flex-end;
			}

			.nutanaa-chat .message-assistant {
				align-items: flex-start;
			}

			.nutanaa-chat .message-bubble {
				padding: 8px 12px;
				border-radius: 8px;
				max-width: 100%;
				word-wrap: break-word;
				overflow-wrap: break-word;
			}

			.nutanaa-chat .message-user .message-bubble {
				background: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
				border-bottom-right-radius: 2px;
			}

			.nutanaa-chat .message-assistant .message-bubble {
				background: var(--vscode-editorWidget-background);
				border: 1px solid var(--vscode-editorWidget-border, #454545);
				border-bottom-left-radius: 2px;
			}

			.nutanaa-chat .message-meta {
				font-size: 11px;
				color: var(--vscode-descriptionForeground, #969696);
				display: flex;
				gap: 8px;
				align-items: center;
			}

			.nutanaa-chat .message-user .message-meta {
				justify-content: flex-end;
			}

			.nutanaa-chat .model-tag {
				background: var(--vscode-badge-background);
				color: var(--vscode-badge-foreground);
				padding: 1px 6px;
				border-radius: 10px;
				font-size: 10px;
			}

			.nutanaa-chat .thinking-indicator {
				display: flex;
				align-items: center;
				gap: 8px;
				padding: 8px 12px;
				background: var(--vscode-editorWidget-background);
				border: 1px solid var(--vscode-editorWidget-border, #454545);
				border-radius: 8px;
				font-size: 12px;
				color: var(--vscode-descriptionForeground, #969696);
			}

			.nutanaa-chat .thinking-dots {
				display: flex;
				gap: 3px;
			}

			.nutanaa-chat .thinking-dot {
				width: 6px;
				height: 6px;
				border-radius: 50%;
				background: var(--vscode-descriptionForeground, #969696);
				animation: thinking-bounce 1.4s ease-in-out infinite both;
			}

			.nutanaa-chat .thinking-dot:nth-child(1) { animation-delay: 0s; }
			.nutanaa-chat .thinking-dot:nth-child(2) { animation-delay: 0.2s; }
			.nutanaa-chat .thinking-dot:nth-child(3) { animation-delay: 0.4s; }

			@keyframes thinking-bounce {
				0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
				40% { transform: scale(1); opacity: 1; }
			}

			.nutanaa-chat .tool-call-card {
				background: var(--vscode-editorWidget-background);
				border: 1px solid var(--vscode-editorWidget-border, #454545);
				border-radius: 6px;
				margin-top: 4px;
				overflow: hidden;
			}

			.nutanaa-chat .tool-call-header {
				display: flex;
				align-items: center;
				gap: 8px;
				padding: 6px 10px;
				cursor: pointer;
				font-size: 12px;
			}

			.nutanaa-chat .tool-call-header:hover {
				background: var(--vscode-list-hoverBackground);
			}

			.nutanaa-chat .tool-call-icon {
				font-size: 14px;
			}

			.nutanaa-chat .tool-call-name {
				flex: 1;
				font-weight: 500;
			}

			.nutanaa-chat .tool-call-status {
				font-size: 11px;
				color: var(--vscode-descriptionForeground, #969696);
			}

			.nutanaa-chat .tool-call-details {
				padding: 8px 10px;
				border-top: 1px solid var(--vscode-editorWidget-border, #454545);
				font-size: 12px;
				font-family: var(--vscode-editor-font-family);
				white-space: pre-wrap;
				word-break: break-all;
			}

			.nutanaa-chat .composer-container {
				border-top: 1px solid var(--vscode-editorWidget-border, #454545);
				background: var(--vscode-sideBar-background);
				padding: 8px 12px;
				flex-shrink: 0;
				position: relative;
			}

			.nutanaa-chat .composer-attachments {
				display: flex;
				flex-wrap: wrap;
				gap: 4px;
				margin-bottom: 6px;
			}

			.nutanaa-chat .attachment-chip {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				background: var(--vscode-badge-background);
				color: var(--vscode-badge-foreground);
				padding: 2px 8px;
				border-radius: 12px;
				font-size: 11px;
			}

			.nutanaa-chat .attachment-chip-remove {
				background: none;
				border: none;
				color: inherit;
				cursor: pointer;
				padding: 0;
				font-size: 14px;
				line-height: 1;
			}

			.nutanaa-chat .input-wrapper {
				display: flex;
				align-items: flex-end;
				gap: 6px;
				background: var(--vscode-input-background);
				border: 1px solid var(--vscode-input-border);
				border-radius: 6px;
				padding: 6px;
			}

			.nutanaa-chat .input-wrapper:focus-within {
				border-color: var(--vscode-focusBorder, #007fd4);
			}

			.nutanaa-chat .chat-input {
				flex: 1;
				background: transparent;
				color: var(--vscode-input-foreground);
				border: none;
				outline: none;
				resize: none;
				font-family: inherit;
				font-size: inherit;
				line-height: 1.5;
				min-height: 20px;
				max-height: 200px;
				padding: 2px 0;
			}

			.nutanaa-chat .chat-input::placeholder {
				color: var(--vscode-descriptionForeground, #969696);
			}

			.nutanaa-chat .composer-button {
				background: transparent;
				color: var(--vscode-foreground);
				border: none;
				padding: 4px;
				border-radius: 4px;
				cursor: pointer;
				display: flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
			}

			.nutanaa-chat .composer-button:hover {
				background: var(--vscode-toolbar-hoverBackground);
			}

			.nutanaa-chat .send-button {
				background: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
			}

			.nutanaa-chat .send-button:hover {
				background: var(--vscode-button-hoverBackground);
			}

			.nutanaa-chat .stop-button {
				background: var(--vscode-errorForeground);
				color: var(--vscode-button-foreground);
			}

			.nutanaa-chat .stop-button:hover {
				opacity: 0.9;
			}

			.nutanaa-chat .composer-footer {
				display: flex;
				align-items: center;
				justify-content: space-between;
				margin-top: 6px;
				font-size: 11px;
				color: var(--vscode-descriptionForeground, #969696);
			}

			.nutanaa-chat .context-controls {
				display: flex;
				gap: 4px;
			}

			.nutanaa-chat .composer-chips {
				display: flex;
				gap: 4px;
				flex-wrap: wrap;
			}

			.nutanaa-chat .context-menu-popover {
				position: absolute;
				background: var(--vscode-dropdown-background);
				border: 1px solid var(--vscode-dropdown-border);
				border-radius: 4px;
				padding: 4px;
				z-index: 1000;
				min-width: 160px;
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
			}

			.nutanaa-chat .context-menu-item {
				display: block;
				width: 100%;
				background: transparent;
				border: none;
				color: var(--vscode-foreground);
				padding: 6px 10px;
				text-align: left;
				cursor: pointer;
				font-size: 12px;
				border-radius: 3px;
			}

			.nutanaa-chat .context-menu-item:hover {
				background: var(--vscode-list-hoverBackground);
			}

			.nutanaa-chat .context-chip-remove {
				background: none;
				border: none;
				color: inherit;
				cursor: pointer;
				padding: 0;
				font-size: 12px;
				line-height: 1;
				margin-left: 2px;
			}

			.nutanaa-chat .context-chip {
				background: transparent;
				border: 1px solid var(--vscode-input-border);
				color: var(--vscode-foreground);
				padding: 2px 6px;
				border-radius: 4px;
				font-size: 11px;
				cursor: pointer;
			}

			.nutanaa-chat .context-chip:hover {
				background: var(--vscode-toolbar-hoverBackground);
			}

			.nutanaa-chat .code-actions {
				display: flex;
				gap: 4px;
				margin-top: 4px;
			}

			.nutanaa-chat .code-action {
				background: var(--vscode-button-secondaryBackground);
				color: var(--vscode-button-secondaryForeground);
				border: 1px solid var(--vscode-button-border, transparent);
				border-radius: 4px;
				padding: 2px 8px;
				font-size: 11px;
				cursor: pointer;
			}

			.nutanaa-chat .code-action:hover {
				background: var(--vscode-button-hoverBackground);
			}

			.nutanaa-chat .code-action:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			.nutanaa-chat .empty-state {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: 16px;
				padding: 40px 20px;
				text-align: center;
				flex: 1;
			}

			.nutanaa-chat .empty-icon {
				font-size: 48px;
				opacity: 0.6;
			}

			.nutanaa-chat .empty-title {
				font-size: 16px;
				font-weight: 600;
				color: var(--vscode-foreground);
			}

			.nutanaa-chat .empty-subtitle {
				font-size: 13px;
				color: var(--vscode-descriptionForeground, #969696);
				max-width: 280px;
			}

			.nutanaa-chat .empty-shortcuts {
				display: flex;
				flex-direction: column;
				gap: 8px;
				width: 100%;
				max-width: 280px;
			}

			.nutanaa-chat .empty-shortcut {
				background: var(--vscode-editorWidget-background);
				border: 1px solid var(--vscode-editorWidget-border, #454545);
				border-radius: 6px;
				padding: 10px 12px;
				text-align: left;
				cursor: pointer;
				font-size: 12px;
				color: var(--vscode-foreground);
			}

			.nutanaa-chat .empty-shortcut:hover {
				border-color: var(--vscode-focusBorder, #007fd4);
			}

			.nutanaa-chat .error-actions {
				display: flex;
				gap: 8px;
				margin-top: 8px;
			}

			.nutanaa-chat .error-action {
				background: transparent;
				border: 1px solid var(--vscode-input-border);
				color: var(--vscode-foreground);
				padding: 4px 10px;
				border-radius: 4px;
				font-size: 12px;
				cursor: pointer;
			}

			.nutanaa-chat .error-action:hover {
				background: var(--vscode-toolbar-hoverBackground);
			}

			.nutanaa-chat .message-bubble pre {
				background: var(--vscode-textCodeBlock-background);
				border-radius: 4px;
				padding: 8px;
				overflow-x: auto;
				margin: 4px 0;
			}

			.nutanaa-chat .message-bubble code {
				font-family: var(--vscode-editor-font-family);
				font-size: 12px;
			}

			.nutanaa-chat .message-bubble a {
				color: var(--vscode-textLink-foreground);
			}

			.nutanaa-chat .message-bubble p {
				margin: 4px 0;
			}

			.nutanaa-chat .message-bubble ul, .nutanaa-chat .message-bubble ol {
				margin: 4px 0;
				padding-left: 20px;
			}

			.nutanaa-chat .messages-container::-webkit-scrollbar {
				width: 8px;
			}

			.nutanaa-chat .messages-container::-webkit-scrollbar-track {
				background: transparent;
			}

			.nutanaa-chat .messages-container::-webkit-scrollbar-thumb {
				background: var(--vscode-scrollbarSlider-background);
				border-radius: 4px;
			}

		.nutanaa-chat .messages-container::-webkit-scrollbar-thumb:hover {
			background: var(--vscode-scrollbarSlider-hoverBackground);
		}

		.nutanaa-chat .chat-bottom-controls {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 8px 12px;
			border-top: 1px solid var(--vscode-editorWidget-border, #454545);
			background: var(--vscode-sideBar-background);
			flex-shrink: 0;
		}

		.nutanaa-chat .chat-bottom-controls .chat-selector {
			background: var(--vscode-dropdown-background);
			color: var(--vscode-dropdown-foreground);
			border: 1px solid var(--vscode-dropdown-border);
			border-radius: 4px;
			padding: 3px 8px;
			font-size: 12px;
			cursor: pointer;
			outline: none;
			min-width: 80px;
		}

		.nutanaa-chat .chat-bottom-controls .chat-action {
			background: transparent;
			color: var(--vscode-foreground);
			border: none;
			padding: 4px 8px;
			border-radius: 4px;
			cursor: pointer;
			font-size: 12px;
			display: flex;
			align-items: center;
			gap: 4px;
		}

		.nutanaa-chat .chat-bottom-controls .chat-action:hover {
			background: var(--vscode-toolbar-hoverBackground);
		}
		`;
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this.container = container;
		this.renderMessagesContainer();
		this.renderEmptyState();
		this.renderComposer();
		this.renderBottomControls();
		this.applyPersistedStateToDom();
	}

	protected override layoutBodyContent(height: number, width: number): void {
		this.container.classList.add('nutanaa-chat');

		const bottomControlsHeight = this.bottomControlsContainer ? getTotalHeight(this.bottomControlsContainer) : 0;
		const composerHeight = this.composerContainer ? getTotalHeight(this.composerContainer) : 0;
		const emptyHeight = this.emptyStateContainer && this.state.messages.length === 0 ? getTotalHeight(this.emptyStateContainer) : 0;

		this.scrollContainer.style.height = `${height - bottomControlsHeight - composerHeight - emptyHeight}px`;
		this.scrollContainer.style.display = this.state.messages.length === 0 ? 'none' : 'flex';
		this.emptyStateContainer.style.display = this.state.messages.length === 0 ? 'flex' : 'none';
	}

	private renderMessagesContainer(): void {
		this.scrollContainer = append(this.container, $('.messages-container'));
		this.messagesContainer = append(this.scrollContainer, $('.messages-container-inner'));

		this._register(addStandardDisposableListener(this.scrollContainer as HTMLElement, 'scroll', () => {
			this.updateScrollPosition();
		}));
	}

	private renderComposer(): void {
		this.composerContainer = append(this.container, $('.composer-container'));

		if (this.state.attachments.length > 0) {
			const attachmentsContainer = append(this.composerContainer, $('.composer-attachments'));
			for (const attachment of this.state.attachments) {
				const chip = append(attachmentsContainer, $('.attachment-chip'));
				chip.textContent = attachment.name;
				const removeBtn = append(chip, $('button.attachment-chip-remove'));
				removeBtn.textContent = '×';
				this._register(addStandardDisposableListener(removeBtn as HTMLElement, 'click', () => {
					this.removeAttachment(attachment.id);
				}));
			}
		}

		const inputWrapper = append(this.composerContainer, $('.input-wrapper'));

		this.contextButton = append(inputWrapper, $('button.composer-button'));
		this.contextButton.title = localize('addContext', 'Add Context');
		this.contextButton.textContent = '@';
		this._register(addStandardDisposableListener(this.contextButton as HTMLElement, 'click', () => {
			this.showContextMenu();
		}));

		this.inputElement = append(inputWrapper, $('textarea.chat-input'));
		this.inputElement.placeholder = localize('chatPlaceholder', 'Message AI Chat...');
		this.inputElement.rows = 1;

		this._register(addStandardDisposableListener(this.inputElement as HTMLElement, 'input', () => {
			this.handleInputChange();
		}));

		this._register(addStandardDisposableListener(this.inputElement as HTMLElement, 'keydown', (e) => {
			const event = e as unknown as KeyboardEvent;
			if (event.key === 'Enter' && !event.shiftKey) {
				event.preventDefault();
				this.sendMessage();
			}
		}));

		this._register(addStandardDisposableListener(this.inputElement as HTMLElement, 'paste', (e) => {
			this.handlePaste(e as ClipboardEvent);
		}));

		this.attachmentButton = append(inputWrapper, $('button.composer-button'));
		this.attachmentButton.title = localize('attachFile', 'Attach File');
		this.attachmentButton.textContent = '📎';
		this._register(addStandardDisposableListener(this.attachmentButton as HTMLElement, 'click', () => {
			this.showAttachmentPicker();
		}));

		this.sendButton = append(inputWrapper, $('button.composer-button.send-button'));
		this.sendButton.title = localize('sendMessage', 'Send');
		this.sendButton.textContent = '➤';
		this._register(addStandardDisposableListener(this.sendButton as HTMLElement, 'click', () => {
			this.sendMessage();
		}));

		this.stopButton = append(inputWrapper, $('button.composer-button.stop-button'));
		this.stopButton.title = localize('stopGeneration', 'Stop');
		this.stopButton.textContent = '■';
		this.stopButton.style.display = 'none';
		this._register(addStandardDisposableListener(this.stopButton as HTMLElement, 'click', () => {
			this.stopGeneration();
		}));

		const footer = append(this.composerContainer, $('.composer-footer'));

		this.contextChipsContainer = append(footer, $('.composer-chips'));
		this.renderContextChips();

		const contextControls = append(footer, $('.context-controls'));
		const ctxFile = append(contextControls, $('button.context-chip', {}, '@file'));
		this._register(addStandardDisposableListener(ctxFile as HTMLElement, 'click', () => {
			this.addContextChip('@file');
		}));
		const ctxSelection = append(contextControls, $('button.context-chip', {}, '@selection'));
		this._register(addStandardDisposableListener(ctxSelection as HTMLElement, 'click', () => {
			this.addContextChip('@selection');
		}));

		this.tokenCounter = append(footer, $('span'));
		this.updateTokenCounter();
	}

	private renderBottomControls(): void {
		this.bottomControlsContainer = append(this.container, $('.chat-bottom-controls'));

		this.modeSelector = append(this.bottomControlsContainer, $('select.chat-selector'));
		for (const mode of CHAT_MODES) {
			const option = append(this.modeSelector, $('option', {}, mode.label));
			(option as HTMLSelectElement).value = mode.id;
		}
		(this.modeSelector as HTMLSelectElement).value = this.state.selectedMode;
		this._register(addStandardDisposableListener(this.modeSelector as HTMLElement, 'change', () => {
			const mode = (this.modeSelector as HTMLSelectElement).value as ChatMode;
			this.state = { ...this.state, selectedMode: mode };
			this.storageService.store(ChatView.MODE_STORE_KEY, mode, StorageScope.APPLICATION, StorageTarget.USER);
		}));

		this.providerSelector = append(this.bottomControlsContainer, $('select.chat-selector'));
		this._register(addStandardDisposableListener(this.providerSelector as HTMLElement, 'change', () => {
			const provider = (this.providerSelector as HTMLSelectElement).value;
			this.updateSelectors();
			this.storageService.store('nutanaa.chat.provider', provider, StorageScope.APPLICATION, StorageTarget.USER);
		}));

		this.modelSelector = append(this.bottomControlsContainer, $('select.chat-selector'));
		this._register(addStandardDisposableListener(this.modelSelector as HTMLElement, 'change', () => {
			const model = (this.modelSelector as HTMLSelectElement).value;
			this.storageService.store('nutanaa.chat.model', model, StorageScope.APPLICATION, StorageTarget.USER);
		}));

		this.updateSelectors();

		const newChatButton = append(this.bottomControlsContainer, $('button.chat-action'));
		newChatButton.title = localize('newChat', 'New Chat');
		newChatButton.textContent = '＋';
		this._register(addStandardDisposableListener(newChatButton as HTMLElement, 'click', () => {
			this.clearChat();
		}));
	}

	private renderEmptyState(): void {
		this.emptyStateContainer = append(this.container, $('.empty-state'));

		const icon = append(this.emptyStateContainer, $('.empty-icon'));
		icon.textContent = '✦';

		append(this.emptyStateContainer, $('.empty-title', {}, 'Nutanaa AI'));
		append(this.emptyStateContainer, $('.empty-subtitle', {}, 'Ask anything about your codebase.'));

		const shortcuts = append(this.emptyStateContainer, $('.empty-shortcuts'));
		for (const shortcut of MOCK_SHORTCUTS) {
			const btn = append(shortcuts, $('button.empty-shortcut'));
			btn.textContent = shortcut.title;
			this._register(addStandardDisposableListener(btn as HTMLElement, 'click', () => {
				this.inputElement.value = shortcut.prompt;
				this.handleInputChange();
				this.inputElement.focus();
			}));
		}
	}

	private setupEventListeners(): void {
		this._register(this.runtimeEventBus.on<AgentEvent>(RuntimeEventType.AgentFailed, (event: RuntimeEvent<AgentEvent>) => {
			this.handleAgentError(event);
		}));

		this._register(this.runtimeEventBus.on<AgentStreamEvent>(RuntimeEventType.AgentStream, (event: RuntimeEvent<AgentStreamEvent>) => {
			this.handleStreamChunk(event);
		}));
	}

	private loadPersistedState(): void {
		const storedMessages = this.storageService.get(ChatView.MESSAGES_STORE_KEY, StorageScope.APPLICATION);
		const storedInput = this.storageService.get(ChatView.INPUT_STORE_KEY, StorageScope.APPLICATION);

		if (storedMessages) {
			try {
				this.state = { ...this.state, messages: JSON.parse(storedMessages) };
			} catch {
				this.state = { ...this.state, messages: [] };
			}
		}

		if (storedInput) {
			this.state = { ...this.state, inputText: storedInput };
		}
	}

	private applyPersistedStateToDom(): void {
		if (this.inputElement) {
			this.inputElement.value = this.state.inputText;
		}
	}

	public override saveState(): void {
		this.storageService.store(ChatView.MESSAGES_STORE_KEY, JSON.stringify(this.state.messages), StorageScope.APPLICATION, StorageTarget.USER);
		this.storageService.store(ChatView.INPUT_STORE_KEY, this.state.inputText, StorageScope.APPLICATION, StorageTarget.USER);
	}

	private async sendMessage(): Promise<void> {
		const text = this.inputElement.value.trim();
		if (!text || this.state.isGenerating) {
			return;
		}

		const userMessage: IChatMessage = {
			id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			role: 'user',
			content: text,
			timestamp: Date.now(),
			tokens: this.estimateTokens(text),
			attachments: this.state.attachments,
		};

		const currentMessages = this.state.messages;
		this.state = { ...this.state, messages: [...currentMessages, userMessage] };
		this.state = { ...this.state, inputText: '' };
		this.inputElement.value = '';
		this.state = { ...this.state, attachments: [] };
		this.renderMessages();
		this.saveState();

		// Start generating response
		await this.generateResponse(userMessage);
	}

	private async generateResponse(userMessage: IChatMessage): Promise<void> {
		this.state = { ...this.state, isGenerating: true };
		this.updateInputState();

		const abortController = new AbortController();
		this.currentExecution = {
			abortController,
			messageId: userMessage.id,
		};

		const assistantMessage: IChatMessage = {
			id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			role: 'assistant',
			content: '',
			timestamp: Date.now(),
			tokens: 0,
			toolCalls: [],
		};

		const currentMessages = this.state.messages;
		this.state = { ...this.state, messages: [...currentMessages, assistantMessage] };
		this.pendingMessages.set(assistantMessage.id, assistantMessage);
		this.streamingMessageId = assistantMessage.id;

		this.renderStreamingIndicator();
		this.renderMessages();

		try {
			const request: IAgentExecutionRequest = {
				requestId: `req-chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
				agentId: this.state.selectedMode || 'chat',
				title: userMessage.content,
				payload: { input: userMessage.content },
				priority: 'normal',
				timeoutMs: 0,
				maxRetries: 0,
				workflowId: undefined,
				workflowNodeId: undefined,
			};

			const response = await this.runtimeCoordinator.executeAgent(request);

			if (response.status === 'success' && response.output !== undefined) {
				const output = typeof response.output === 'string'
					? response.output
					: JSON.stringify(response.output);
				const finalMessage = { ...assistantMessage, content: output };
				this.pendingMessages.set(assistantMessage.id, finalMessage);
				this.state = {
					...this.state,
					messages: this.state.messages.map(m =>
						m.id === assistantMessage.id ? finalMessage : m
					),
				};
				this.pendingMessages.delete(assistantMessage.id);
			} else {
				const errorMessage = {
					...assistantMessage,
					content: response.error || 'Agent execution failed',
				};
				this.pendingMessages.set(assistantMessage.id, errorMessage);
				this.state = {
					...this.state,
					messages: this.state.messages.map(m =>
						m.id === assistantMessage.id ? errorMessage : m
					),
				};
			}
		} catch (error) {
			const currentMessage = this.pendingMessages.get(assistantMessage.id);
			if (currentMessage) {
				const errorMessage = {
					...currentMessage,
					content: error instanceof Error ? error.message : String(error),
				} as IChatMessage;
				this.pendingMessages.set(assistantMessage.id, errorMessage);
				this.state = {
					...this.state,
					messages: this.state.messages.map(m =>
						m.id === assistantMessage.id ? errorMessage : m
					),
				};
			}
		} finally {
			this.state = { ...this.state, isGenerating: false };
			this.streamingMessageId = undefined;
			this.currentExecution = undefined;
			if (this.thinkingIndicator) {
				this.thinkingIndicator.remove();
				this.thinkingIndicator = undefined;
			}
			this.renderMessages();
			this.updateInputState();
			this.updateTokenCounter();
			this.saveState();
		}
	}

	private stopGeneration(): void {
		if (this.currentExecution) {
			this.currentExecution.abortController.abort();
			this.currentExecution = undefined;
		}

		if (this.streamingMessageId) {
			const currentMessage = this.pendingMessages.get(this.streamingMessageId);
			if (currentMessage) {
				const stoppedMessage = {
					...currentMessage,
					content: currentMessage.content + '\n\n*Stopped*',
				} as IChatMessage;
				this.pendingMessages.set(this.streamingMessageId, stoppedMessage);

				this.state = {
					...this.state,
					messages: this.state.messages.map(m =>
						m.id === this.streamingMessageId ? stoppedMessage : m
					),
				};
			}
			this.pendingMessages.delete(this.streamingMessageId);
			this.streamingMessageId = undefined;
		}

		this.state = { ...this.state, isGenerating: false };
		if (this.thinkingIndicator) {
			this.thinkingIndicator.remove();
			this.thinkingIndicator = undefined;
		}
		this.renderMessages();
		this.updateInputState();
	}

	private handleStreamChunk(event: RuntimeEvent<AgentStreamEvent>): void {
		if (!this.streamingMessageId) {
			return;
		}
		const chunk = event.payload.chunk;
		const currentMessage = this.pendingMessages.get(this.streamingMessageId);
		if (currentMessage) {
			const updated = { ...currentMessage, content: currentMessage.content + chunk };
			this.pendingMessages.set(this.streamingMessageId, updated);
			this.renderStreamingContent(this.streamingMessageId, updated.content);
		}
	}

	private renderStreamingContent(messageId: string, content: string): void {
		const contentElement = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement | null;
		if (contentElement) {
			clearNode(contentElement);
			const markdown = this.renderMarkdown(content);
			contentElement.appendChild(markdown);
			this.attachCodeBlockActions(contentElement, content);
		}
	}

	private renderCodeBlockActions(codeBlock: HTMLElement, code: string): void {
		const actions = append(codeBlock, $('.code-actions'));
		const copyButton = append(actions, $('button.code-action.copy-button'));
		copyButton.textContent = 'Copy';
		this._register(addStandardDisposableListener(copyButton as HTMLElement, 'click', () => {
			this.copyCodeBlock(code);
		}));
	}

	private copyCodeBlock(code: string): void {
		navigator.clipboard.writeText(code).catch(() => {
			// Silently fail — copy is a convenience, not critical.
		});
	}

	private handleInputChange(): void {
		this.state = { ...this.state, inputText: this.inputElement.value };
		this.adjustTextareaHeight();
		this.saveState();
	}

	private renderMessages(): void {
		clearNode(this.messagesContainer);

		for (const message of this.state.messages) {
			const messageElement = this.createMessageElement(message);
			this.messagesContainer.appendChild(messageElement);
		}

		this.updateScrollPosition();
	}

	private createMessageElement(message: IChatMessage): HTMLElement {
		const element = append(this.messagesContainer, $(`.message.message-${message.role}`));

		const bubble = append(element, $('.message-bubble'));
		bubble.dataset.messageId = message.id;

		if (message.role === 'user') {
			bubble.textContent = message.content;
		} else if (message.role === 'assistant') {
			if (message.content) {
				const markdown = this.renderMarkdown(message.content);
				bubble.appendChild(markdown);
				this.attachCodeBlockActions(bubble, message.content);
			}

			if (message.toolCalls && message.toolCalls.length > 0) {
				for (const toolCall of message.toolCalls) {
					const toolCard = this.createToolCard(toolCall);
					bubble.appendChild(toolCard);
				}
			}
		}

		const meta = append(element, $('.message-meta'));
		meta.textContent = this.formatTimestamp(message.timestamp);

		if (message.tokens > 0) {
			append(meta, $('span', {}, `${message.tokens} tokens`));
		}

		if (message.metadata?.model) {
			append(meta, $('span.model-tag', {}, message.metadata.model));
		}

		return element;
	}

	private createToolCard(toolCall: { readonly toolName: string; readonly arguments: Record<string, unknown>; readonly status: string }): HTMLElement {
		const card = append(this.messagesContainer, $('.tool-call-card'));

		const header = append(card, $('.tool-call-header'));
		const icon = append(header, $('.tool-call-icon'));
		icon.textContent = '🔧';

		const name = append(header, $('.tool-call-name'));
		name.textContent = toolCall.toolName;

		const status = append(header, $('.tool-call-status'));
		status.textContent = toolCall.status;

		const details = append(card, $('.tool-call-details'));
		details.textContent = JSON.stringify(toolCall.arguments, null, 2);
		details.style.display = 'none';

		this._register(addStandardDisposableListener(header as HTMLElement, 'click', () => {
			details.style.display = details.style.display === 'none' ? 'block' : 'none';
		}));

		return card;
	}

	private renderStreamingIndicator(): HTMLElement {
		this.thinkingIndicator = append(this.messagesContainer, $('.thinking-indicator'));
		const dots = append(this.thinkingIndicator, $('.thinking-dots'));
		for (let i = 0; i < 3; i++) {
			append(dots, $('.thinking-dot'));
		}
		const label = append(this.thinkingIndicator, $('span'));
		label.textContent = 'Thinking...';
		return this.thinkingIndicator;
	}

	private attachCodeBlockActions(container: HTMLElement, markdownText: string): void {
		const codeBlocks = container.querySelectorAll('pre code');
		codeBlocks.forEach((block) => {
			const code = (block as HTMLElement).textContent || '';
			const pre = block.parentElement;
			if (pre) {
				this.renderCodeBlockActions(pre as HTMLElement, code);
			}
		});
	}

	private renderMarkdown(content: string): HTMLElement {
		const rendered = this.markdownRenderer({
			value: content,
			isTrusted: true,
		});
		return rendered.element;
	}

	private updateScrollPosition(): void {
		const scrollPosition = this.scrollContainer.scrollTop;
		const scrollHeight = this.scrollContainer.scrollHeight;
		const clientHeight = this.scrollContainer.clientHeight;

		if (scrollPosition + clientHeight >= scrollHeight - 50) {
			this.scrollContainer.scrollTop = scrollHeight;
		}
	}

	private updateInputState(): void {
		this.sendButton.style.display = this.state.isGenerating ? 'none' : 'flex';
		this.inputElement.disabled = this.state.isGenerating;
		this.inputElement.placeholder = this.state.isGenerating
			? localize('generating', 'Generating...')
			: localize('chatPlaceholder', 'Message AI Chat...');

		if (this.stopButton) {
			this.stopButton.style.display = this.state.isGenerating ? 'flex' : 'none';
		}
	}

	private updateSelectors(): void {
		clearNode(this.providerSelector);
		const defaultProviderOption = append(this.providerSelector, $('option', {}, 'Select provider'));
		(defaultProviderOption as HTMLSelectElement).value = '';

		for (const provider of MOCK_PROVIDERS) {
			const option = append(this.providerSelector, $('option', {}, provider.name));
			(option as HTMLSelectElement).value = provider.id;
		}

		clearNode(this.modelSelector);
		const defaultModelOption = append(this.modelSelector, $('option', {}, 'Select model'));
		(defaultModelOption as HTMLSelectElement).value = '';

		const selectedProvider = this.state.selectedProvider;
		if (selectedProvider) {
			const provider = MOCK_PROVIDERS.find(p => p.id === selectedProvider);
			if (provider) {
				for (const model of provider.models) {
					const option = append(this.modelSelector, $('option', {}, model));
					(option as HTMLSelectElement).value = model;
				}
			}
		}

		if (!selectedProvider && MOCK_PROVIDERS.length > 0) {
			this.state = { ...this.state, selectedProvider: MOCK_PROVIDERS[0].id };
			(this.providerSelector as HTMLSelectElement).value = MOCK_PROVIDERS[0].id;
			this.updateSelectors();
		}
	}

	private removeAttachment(id: string): void {
		const attachments = this.state.attachments.filter(a => a.id !== id);
		this.state = { ...this.state, attachments };
		this.renderComposerAttachments();
		this.saveState();
	}

	private renderComposerAttachments(): void {
		const existing = this.composerContainer.querySelector('.composer-attachments');
		if (existing) {
			clearNode(existing as HTMLElement);
		}

		if (this.state.attachments.length > 0) {
			const attachmentsContainer = existing ? existing as HTMLElement : append(this.composerContainer, $('.composer-attachments'));
			if (!existing) {
				this.composerContainer.insertBefore(attachmentsContainer, this.composerContainer.firstChild);
			}
			for (const attachment of this.state.attachments) {
				const chip = append(attachmentsContainer, $('.attachment-chip'));
				chip.textContent = attachment.name;
				const removeBtn = append(chip, $('button.attachment-chip-remove'));
				removeBtn.textContent = '×';
				this._register(addStandardDisposableListener(removeBtn as HTMLElement, 'click', () => {
					this.removeAttachment(attachment.id);
				}));
			}
		}
	}

	private renderContextChips(): void {
		if (!this.contextChipsContainer) {
			return;
		}
		clearNode(this.contextChipsContainer);
		for (const chip of this.state.contextChips) {
			const chipEl = append(this.contextChipsContainer, $('.context-chip'));
			chipEl.textContent = chip;
			const removeBtn = append(chipEl, $('button.context-chip-remove'));
			removeBtn.textContent = '×';
			this._register(addStandardDisposableListener(removeBtn as HTMLElement, 'click', () => {
				const chips = this.state.contextChips.filter(c => c !== chip);
				this.state = { ...this.state, contextChips: chips };
				this.renderContextChips();
			}));
		}
	}

	private showContextMenu(): void {
		if (this.contextMenuPopover) {
			this.contextMenuPopover.remove();
			this.contextMenuPopover = undefined;
			if (this.contextMenuDisposer) {
				this.contextMenuDisposer.dispose();
				this.contextMenuDisposer = undefined;
			}
			return;
		}

		const popover = append(this.composerContainer, $('.context-menu-popover'));
		popover.style.bottom = '100%';
		popover.style.left = '0';
		popover.style.marginBottom = '4px';
		this.contextMenuPopover = popover;

		for (const option of MOCK_CONTEXT_OPTIONS) {
			const item = append(popover, $('button.context-menu-item'));
			item.textContent = option.label;
			this._register(addStandardDisposableListener(item as HTMLElement, 'click', () => {
				this.addContextChip(option.label);
				this.showContextMenu();
			}));
		}

		this.contextMenuDisposer = addStandardDisposableListener(this.container as HTMLElement, 'click', (e) => {
			if (!popover.contains(e.target as Node) && e.target !== this.contextButton) {
				this.showContextMenu();
			}
		}, true);
	}

	private addContextChip(label: string): void {
		const chips = this.state.contextChips;
		if (!chips.includes(label)) {
			this.state = { ...this.state, contextChips: [...chips, label] };
			this.renderContextChips();
		}
	}

	private showAttachmentPicker(): void {
		if (!this.attachmentInput) {
			this.attachmentInput = document.createElement('input') as HTMLInputElement;
			this.attachmentInput.type = 'file';
			this.attachmentInput.style.display = 'none';
			this.attachmentInput.multiple = false;
			this._register(addStandardDisposableListener(this.attachmentInput, 'change', () => {
				const file = this.attachmentInput?.files?.[0];
				if (file) {
					this.addAttachment(file.name);
				}
				if (this.attachmentInput) {
					this.attachmentInput.value = '';
				}
			}));
			document.body.appendChild(this.attachmentInput);
		}

		this.attachmentInput.click();
	}

	private addAttachment(name: string): void {
		const attachment: IChatAttachment = {
			id: `att-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			name,
			type: 'file',
		};
		this.state = { ...this.state, attachments: [...this.state.attachments, attachment] };
		this.renderComposerAttachments();
		this.saveState();
	}

	private updateTokenCounter(): void {
		const totalTokens = this.state.messages.reduce((sum, m) => sum + m.tokens, 0);
		this.tokenCounter.textContent = localize('tokenCount', 'Tokens: {0}', totalTokens);
	}

	private adjustTextareaHeight(): void {
		this.inputElement.style.height = 'auto';
		const scrollHeight = this.inputElement.scrollHeight;
		const maxHeight = 200;
		this.inputElement.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
		this._onDidChangeContentHeight.fire(Math.min(scrollHeight, maxHeight));
	}

	private clearChat(): void {
		this.state = { ...this.state, messages: [] };
		this.renderMessages();
		this.updateTokenCounter();
		this.saveState();
	}

	private handleAgentError(event: RuntimeEvent<AgentEvent>): void {
		// Handle error events
	}

	private handlePaste(event: ClipboardEvent): void {
		const text = event.clipboardData?.getData('text');
		if (text) {
			this.state = { ...this.state, inputText: this.state.inputText + text };
			this.inputElement.value = this.state.inputText;
		}
	}

	private formatTimestamp(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	private estimateTokens(text: string): number {
		return Math.ceil(text.length / 4);
	}

	public override dispose(): void {
		if (this.currentExecution) {
			this.currentExecution.abortController.abort();
			this.currentExecution = undefined;
		}

		if (this.contextMenuPopover) {
			this.contextMenuPopover.remove();
			this.contextMenuPopover = undefined;
		}

		if (this.contextMenuDisposer) {
			this.contextMenuDisposer.dispose();
			this.contextMenuDisposer = undefined;
		}

		if (this.attachmentInput && this.attachmentInput.parentElement) {
			this.attachmentInput.parentElement.removeChild(this.attachmentInput);
		}

		this.saveState();
		super.dispose();
	}
}
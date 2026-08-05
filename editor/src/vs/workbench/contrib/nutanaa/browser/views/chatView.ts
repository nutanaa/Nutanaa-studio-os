/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { append, $, addStandardDisposableListener, getTotalHeight, getTotalWidth } from '../../../../base/browser/dom.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { KeybindingService } from '../../../../platform/keybinding/browser/keybindingService.js';
import { ViewPane, ViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { IAgentCoordinator, IAgentExecution } from '../../common/agentCoordinator.js';
import { ITaskScheduler } from '../../common/taskScheduler.js';
import { IRuntimeEventBus, RuntimeEventType } from '../../common/runtimeEventBus.js';
import { IRuntimeStateService, ISessionState } from '../../common/runtimeState.js';
import { IChatSession, IChatMessage, IChatAttachment, IToolCall, IToolResult } from '../../models/studioModel.js';
import { IPromptManager } from '../../common/promptManager.js';
import { IProviderManager } from '../../common/providerManager.js';
import { IModelRegistry } from '../../common/modelRegistry.js';
import { ToolManager, IToolResult as ToolExecResult } from '../toolManager.js';
import { localize } from '../../../../nls.js';
import { MarkdownRenderer } from '../../../../editor/browser/widget/markdownRenderer.js';
import { EditorOption } from '../../../../editor/common/config/editorOptions.js';
import { ContextScopedPasteEvent, IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

interface ChatViewState {
	readonly sessionId: string | undefined;
	readonly messages: IChatMessage[];
	readonly inputText: string;
	readonly isGenerating: boolean;
	readonly attachments: IChatAttachment[];
}

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
export class ChatView extends ViewPane {

	private static readonly MESSAGES_STORE_KEY = 'nutanaa.chat.messages';
	private static readonly INPUT_STORE_KEY = 'nutanaa.chat.input';

	private readonly _onDidChangeContentHeight = this._register(new Emitter<number>());
	public readonly onDidChangeContentHeight = this._onDidChangeContentHeight.event;

	private container!: HTMLElement;
	private messagesContainer!: HTMLElement;
	private inputContainer!: HTMLElement;
	private inputElement!: HTMLTextAreaElement;
	private sendButton!: HTMLElement;
	private attachmentButton!: HTMLElement;
	private tokenCounter!: HTMLElement;
	private modelSelector!: HTMLElement;
	private scrollContainer!: HTMLElement;

	private state: ChatViewState = {
		sessionId: undefined,
		messages: [],
		inputText: '',
		isGenerating: false,
		attachments: [],
	};

	private currentExecution: { abortController: AbortController; messageId: string } | undefined;
	private pendingMessages: Map<string, IChatMessage> = new Map();
	private markdownRenderer: MarkdownRenderer;
	private readonly hoverDelegate: IHoverDelegate;
	private readonly clipboardService: IClipboardService;

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
		@IAgentCoordinator private readonly agentCoordinator: IAgentCoordinator,
		@ITaskScheduler private readonly taskScheduler: ITaskScheduler,
		@IPromptManager private readonly promptManager: IPromptManager,
		@IProviderManager private readonly providerManager: IProviderManager,
		@IModelRegistry private readonly modelRegistry: IModelRegistry,
		@ToolManager private readonly toolManager: ToolManager,
		@IClipboardService clipboardService: IClipboardService,
		@IConfigurationService configurationService: IConfigurationService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super(options, instantiationService, contextViewService, configurationService, keybindingService, themeService, storageService, logService, hoverService);

		this.markdownRenderer = instantiationService.createInstance(MarkdownRenderer, {});
		this.hoverDelegate = {
			get: () => this.hoverService,
			showHover: (options) => this.hoverService.showHover(options),
			hideHover: () => this.hoverService.hideHover(),
		};
		this.clipboardService = clipboardService;
		this._register = new DisposableStore();

		this.loadState();
		this.setupEventListeners();
	}

	protected override renderBody(container: HTMLElement): void {
		this.container = container;
		this.container.classList.add('nutanaa-chat');

		this.renderMessagesContainer();
		this.renderInputContainer();
		this.renderToolbar();
		this.renderTokenCounter();

		this._register(addStandardDisposableListener(container, 'dragover', (e) => {
			e.preventDefault();
			container.classList.add('dragging');
		}));

		this._register(addStandardDisposableListener(container, 'dragleave', (e) => {
			e.preventDefault();
			container.classList.remove('dragging');
		}));

		this._register(addStandardDisposableListener(container, 'drop', (e) => {
			e.preventDefault();
			container.classList.remove('dragging');
			this.handleDrop(e);
		}));
	}

	private renderMessagesContainer(): void {
		this.scrollContainer = append(this.container, $('.scroll-container'));
		this.messagesContainer = append(this.scrollContainer, $('.messages-container'));

		this._register(addStandardDisposableListener(this.scrollContainer, 'scroll', () => {
			this.updateMessagesContainer();
		}));
	}

	private renderInputContainer(): void {
		this.inputContainer = append(this.container, $('.input-container'));

		const inputWrapper = append(this.inputContainer, $('.input-wrapper'));

		this.attachmentButton = append(inputWrapper, $('button.attachment-button'));
		this.attachmentButton.title = localize('attachFile', 'Attach File');
		this.attachmentButton.innerHTML = '&#128206;'; // Paperclip emoji
		this._register(addStandardDisposableListener(this.attachmentButton, 'click', () => {
			this.showAttachmentPicker();
		}));

		this.inputElement = append(inputWrapper, $('textarea.chat-input'));
		this.inputElement.placeholder = localize('chatPlaceholder', 'Type a message to chat with AI...');
		this.inputElement.rows = 1;

		this._register(addStandardDisposableListener(this.inputElement, 'input', () => {
			this.handleInputChange();
		}));

		this._register(addStandardDisposableListener(this.inputElement, 'keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				this.sendMessage();
			}
		}));

		this._register(addStandardDisposableListener(this.inputElement, 'paste', (e) => {
			this.handlePaste(e);
		}));

		this.sendButton = append(inputWrapper, $('button.send-button'));
		this.sendButton.title = localize('sendMessage', 'Send Message');
		this.sendButton.innerHTML = '&#10148;'; // Arrow right
		this._register(addStandardDisposableListener(this.sendButton, 'click', () => {
			this.sendMessage();
		}));
	}

	private renderToolbar(): void {
		const toolbar = append(this.container, $('.chat-toolbar'));

		this.modelSelector = append(toolbar, $('.model-selector'));
		this.modelSelector.title = localize('selectModel', 'Select Model');

		const stopButton = append(toolbar, $('button.toolbar-button.stop-button'));
		stopButton.title = localize('stopGeneration', 'Stop Generation');
		stopButton.innerHTML = '&#9632;'; // Stop square
		stopButton.style.display = 'none';
		this._register(addStandardDisposableListener(stopButton, 'click', () => {
			this.stopGeneration();
		}));

		const continueButton = append(toolbar, $('button.toolbar-button.continue-button'));
		continueButton.title = localize('continueGeneration', 'Continue Generation');
		continueButton.innerHTML = '&#9654;'; // Play triangle
		continueButton.style.display = 'none';

		const exportButton = append(toolbar, $('button.toolbar-button.export-button'));
		exportButton.title = localize('exportConversation', 'Export Conversation');
		exportButton.innerHTML = '&#128190;'; // Floppy disk
		this._register(addStandardDisposableListener(exportButton, 'click', () => {
			this.exportConversation();
		}));

		const clearButton = append(toolbar, $('button.toolbar-button.clear-button'));
		clearButton.title = localize('clearChat', 'Clear Chat');
		clearButton.innerHTML = '&#128465;'; // Trash
		this._register(addStandardDisposableListener(clearButton, 'click', () => {
			this.clearChat();
		}));
	}

	private renderTokenCounter(): void {
		this.tokenCounter = append(this.container, $('.token-counter'));
		this.updateTokenCounter();
	}

	private setupEventListeners(): void {
		// Subscribe to runtime events
		this._register(this.runtimeEventBus.on(RuntimeEventType.AgentResponse, (event) => {
			this.handleAgentResponse(event);
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.AgentStream, (event) => {
			this.handleAgentStream(event);
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.ToolStarted, (event) => {
			this.handleToolStarted(event);
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.ToolCompleted, (event) => {
			this.handleToolCompleted(event);
		}));

		this._register(this.runtimeEventBus.on(RuntimeEventType.AgentExecutionError, (event) => {
			this.handleAgentError(event);
		}));

		// Subscribe to state changes
		this._register(this.runtimeStateService.onDidChangeState(() => {
			this.updateView();
		}));
	}

	private loadState(): void {
		const storedMessages = this.storageService.get(ChatView.MESSAGES_STORE_KEY, 0);
		const storedInput = this.storageService.get(ChatView.INPUT_STORE_KEY, 0);

		if (storedMessages) {
			try {
				this.state.messages = JSON.parse(storedMessages);
			} catch {
				this.state.messages = [];
			}
		}

		if (storedInput) {
			this.state.inputText = storedInput;
			this.inputElement.value = storedInput;
		}

		this.sessionId = `chat-${Date.now()}`;
	}

	private saveState(): void {
		this.storageService.store(ChatView.MESSAGES_STORE_KEY, JSON.stringify(this.state.messages), 0);
		this.storageService.store(ChatView.INPUT_STORE_KEY, this.state.inputText, 0);
	}

	private sessionId: string | undefined;

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

		this.state.messages.push(userMessage);
		this.state.inputText = '';
		this.inputElement.value = '';
		this.state.attachments = [];
		this.renderMessages();
		this.saveState();

		// Start generating response
		await this.generateResponse(userMessage);
	}

	private async generateResponse(userMessage: IChatMessage): Promise<void> {
		this.state.isGenerating = true;
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

		this.state.messages.push(assistantMessage);
		this.pendingMessages.set(assistantMessage.id, assistantMessage);
		this.renderMessages();

		try {
			const provider = this.providerManager.getSelectedProvider();
			const model = this.modelRegistry.getSelectedProvider
				? this.modelRegistry.getSelectedProvider()?.model
				: undefined;

			// Build context from conversation history
			const recentMessages = this.state.messages.slice(-20);
			const context = recentMessages.map(m => ({
				role: m.role,
				content: m.content,
			}));

			// Execute agent
			const execution = await this.agentCoordinator.executeAgent({
				agentId: 'chat',
				input: userMessage.content,
				context,
				stream: true,
				timeout: 120000,
			}, abortController.signal);

			// Handle streaming response
			for await (const chunk of execution.stream) {
				if (abortController.signal.aborted) {
					break;
				}

				const currentMessage = this.pendingMessages.get(assistantMessage.id);
				if (currentMessage) {
					currentMessage.content += chunk;
					this.renderStreamingContent(assistantMessage.id, currentMessage.content);
				}
			}

			// Mark complete
			const finalMessage = this.pendingMessages.get(assistantMessage.id);
			if (finalMessage) {
				finalMessage.tokens = this.estimateTokens(finalMessage.content);
				this.pendingMessages.delete(assistantMessage.id);
			}

		} catch (error) {
			const currentMessage = this.pendingMessages.get(assistantMessage.id);
			if (currentMessage) {
				currentMessage.content = `Error: ${error instanceof Error ? error.message : String(error)}`;
				currentMessage.metadata = { error: true };
				this.pendingMessages.delete(assistantMessage.id);
			}
		} finally {
			this.state.isGenerating = false;
			this.currentExecution = undefined;
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

		this.state.isGenerating = false;
		this.updateInputState();
	}

	private continueGeneration(): void {
		// TODO: Implement continue from last message
	}

	private handleInputChange(): void {
		this.state.inputText = this.inputElement.value;
		this.adjustTextareaHeight();
		this.saveState();
	}

	private handlePaste(event: ContextScopedPasteEvent): void {
		const text = event.text;
		const html = event.html;

		if (html) {
			// Handle pasted HTML
			const attachment: IChatAttachment = {
				id: `attach-${Date.now()}`,
				type: 'code',
				name: 'Pasted Content',
				content: text,
			};
			this.state.attachments.push(attachment);
		}
	}

	private handleDrop(event: DragEvent): void {
		event.preventDefault();

		const files = event.dataTransfer?.files;
		if (files) {
			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				const attachment = this.fileToAttachment(file);
				if (attachment) {
					this.state.attachments.push(attachment);
				}
			}
			this.renderAttachments();
		}
	}

	private fileToAttachment(file: File): IChatAttachment | undefined {
		const id = `attach-${Date.now()}-${Math.random().toString(36).slice(2)}`;

		if (file.type.startsWith('image/')) {
			return {
				id,
				type: 'image',
				name: file.name,
				mimeType: file.type,
			};
		}

		return {
			id,
			type: 'file',
			name: file.name,
			mimeType: file.type,
		};
	}

	private showAttachmentPicker(): void {
		// TODO: Implement file picker dialog
	}

	private renderMessages(): void {
		this.messagesContainer.innerHTML = '';

		for (const message of this.state.messages) {
			const messageElement = this.createMessageElement(message);
			this.messagesContainer.appendChild(messageElement);
		}

		this.updateMessagesContainer();
	}

	private createMessageElement(message: IChatMessage): HTMLElement {
		const element = append(this.messagesContainer, $(`.message.message-${message.role}`));

		const avatar = append(element, $('.message-avatar'));
		avatar.textContent = this.getRoleEmoji(message.role);

		const content = append(element, $('.message-content'));
		content.dataset.messageId = message.id;

		if (message.role === 'user') {
			content.textContent = message.content;
		} else {
			const markdown = this.renderMarkdown(message.content);
			content.appendChild(markdown);
		}

		// Render tool calls if present
		if (message.toolCalls && message.toolCalls.length > 0) {
			const toolCalls = append(content, $('.tool-calls'));
			for (const call of message.toolCalls) {
				const callElement = append(toolCalls, $('.tool-call'));
				callElement.textContent = `Calling ${call.toolName}...`;
				callElement.dataset.callId = call.id;
			}
		}

		// Render tool results if present
		if (message.toolResults && message.toolResults.length > 0) {
			const results = append(content, $('.tool-results'));
			for (const result of message.toolResults) {
				const resultElement = append(results, $('.tool-result'));
				resultElement.className = result.success ? 'tool-result-success' : 'tool-result-error';
				resultElement.textContent = result.success
					? `${result.content.slice(0, 200)}`
					: `Error: ${result.error}`;
			}
		}

		// Render metadata
		const meta = append(element, $('.message-meta'));
		meta.textContent = this.formatTimestamp(message.timestamp);

		if (message.tokens > 0) {
			append(meta, $('span.tokens', {}, `${message.tokens} tokens`));
		}

		if (message.metadata?.model) {
			append(meta, $('span.model-tag', {}, message.metadata.model as string));
		}

		return element;
	}

	private renderStreamingContent(messageId: string, content: string): void {
		const contentElement = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
		if (contentElement) {
			const markdown = this.renderMarkdown(content);
			contentElement.innerHTML = '';
			contentElement.appendChild(markdown);
		}
	}

	private renderMarkdown(content: string): HTMLElement {
		const rendered = this.markdownRenderer.render({
			value: content,
			isTrusted: true,
		});
		return rendered.element;
	}

	private updateMessagesContainer(): void {
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
			: localize('chatPlaceholder', 'Type a message to chat with AI...');

		const stopButton = this.container.querySelector('.stop-button') as HTMLElement;
		if (stopButton) {
			stopButton.style.display = this.state.isGenerating ? 'flex' : 'none';
		}
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

	private renderAttachments(): void {
		// TODO: Render attachment previews
	}

	private exportConversation(): void {
		const exportData = {
			sessionId: this.sessionId,
			exportedAt: Date.now(),
			messages: this.state.messages,
		};

		const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `conversation-${Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	private clearChat(): void {
		this.state.messages = [];
		this.sessionId = `chat-${Date.now()}`;
		this.renderMessages();
		this.updateTokenCounter();
		this.saveState();
	}

	private handleAgentResponse(event: { payload: { agentId: string; response: string; executionTime: number } }): void {
		// Handle agent response events
	}

	private handleAgentStream(event: { payload: { agentId: string; chunk: string } }): void {
		// Handle streaming events
	}

	private handleToolStarted(event: { payload: { toolId: string; toolName: string; executionId: string } }): void {
		// Handle tool started events
	}

	private handleToolCompleted(event: { payload: { toolId: string; toolName: string; executionId: string; success: boolean } }): void {
		// Handle tool completed events
	}

	private handleAgentError(event: { payload: { agentId: string; error: string } }): void {
		// Handle error events
	}

	private updateView(): void {
		// Update view based on state changes
	}

	private getRoleEmoji(role: string): string {
		switch (role) {
			case 'user': return '👤';
			case 'assistant': return '🤖';
			case 'tool': return '🔧';
			case 'system': return '⚙️';
			default: return '❓';
		}
	}

	private formatTimestamp(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	private estimateTokens(text: string): number {
		return Math.ceil(text.length / 4);
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);

		const inputHeight = this.inputContainer ? getTotalHeight(this.inputContainer) : 60;
		const toolbarHeight = 36;
		const tokenHeight = 24;

		this.scrollContainer.style.height = `${height - inputHeight - toolbarHeight - tokenHeight}px`;
	}

	public override dispose(): void {
		this.saveState();
		this._register.dispose();
		super.dispose();
	}
}

// Helper interface for keybinding service
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IHoverDelegate } from '../../../../platform/hover/browser/hoverDelegate.js';

// Helper type for hover options
import type { IHoverOptions } from '../../../../platform/hover/browser/hover.js';
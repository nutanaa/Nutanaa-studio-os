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
import { IWorkflowGraph, IWorkflowNode, IWorkflowEdge, WorkflowNodeType, IWorkflowPaletteItem } from '../../models/studioModel.js';
import { IWorkflowEngine } from '../../common/workflowEngine.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

/**
 * Workflow Designer View for Nutanaa Studio OS.
 *
 * Responsibilities:
 * - Visual node editor with drag and drop
 * - Execution graph visualization
 * - Conditional, loop, parallel, retry nodes
 * - Validation and save/load
 * - Workflow execution and visualization
 */
export class WorkflowDesignerView extends ViewPane {

	private static readonly WORKFLOWS_STORE_KEY = 'nutanaa.workflows';

	private readonly _onDidChange = this._register(new Emitter<void>());
	public readonly onDidChange = this._onDidChange.event;

	private container!: HTMLElement;
	private toolbarContainer!: HTMLElement;
	private paletteContainer!: HTMLElement;
	private canvasContainer!: HTMLElement;
	private propertiesContainer!: HTMLElement;

	private workflows: Map<string, IWorkflowGraph> = new Map();
	private currentWorkflow: IWorkflowGraph | undefined;
	private selectedNode: IWorkflowNode | undefined;
	private selectedEdge: IWorkflowEdge | undefined;

	private zoom: number = 1;
	private isDragging: boolean = false;
	private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
	private draggedItem: { type: 'node' | 'edge'; id: string } | undefined;

	private readonly paletteItems: IWorkflowPaletteItem[] = [
		{ type: 'sequential', label: 'Sequential', icon: '→', description: 'Execute nodes one after another' },
		{ type: 'parallel', label: 'Parallel', icon: '∥', description: 'Execute multiple nodes concurrently' },
		{ type: 'conditional', label: 'Conditional', icon: '◇', description: 'Branch based on condition' },
		{ type: 'loop', label: 'Loop', icon: '↻', description: 'Repeat until condition met' },
		{ type: 'retry', label: 'Retry', icon: '↺', description: 'Retry on failure' },
		{ type: 'agent', label: 'Agent', icon: '🤖', description: 'Execute an agent' },
		{ type: 'tool', label: 'Tool', icon: '🔧', description: 'Execute a tool' },
		{ type: 'start', label: 'Start', icon: '▶', description: 'Workflow start' },
		{ type: 'end', label: 'End', icon: '⏹', description: 'Workflow end' },
	];

	private readonly _register: DisposableStore;

	constructor(
		options: ViewPaneOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IContextViewService contextViewService: IContextViewViewService,
		@ILogService logService: ILogService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IHoverService hoverService: IHoverService,
		@IKeybindingService keybindingService: KeybindingService,
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IWorkflowEngine private readonly workflowEngine: IWorkflowEngine,
		@IConfigurationService configurationService: IConfigurationService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super(options, instantiationService, contextViewService, configurationService, keybindingService, themeService, storageService, logService, hoverService);

		this._register = new DisposableStore();

		this.loadWorkflows();
	}

	protected override renderBody(container: HTMLElement): void {
		this.container = container;
		this.container.classList.add('nutanaa-workflow-designer');

		this.renderToolbar();
		this.renderPalette();
		this.renderCanvas();
		this.renderPropertiesPanel();

		this.setupCanvasEventListeners();
	}

	private renderToolbar(): void {
		this.toolbarContainer = append(this.container, $('.workflow-toolbar'));

		// Workflow selector
		const selector = append(this.toolbarContainer, $('select.workflow-selector'));
		this._register(addStandardDisposableListener(selector, 'change', () => {
			const workflowId = selector.value;
			this.loadWorkflow(workflowId);
		}));

		// New workflow button
		const newButton = append(this.toolbarContainer, $('button.toolbar-button', {}, localize('newWorkflow', 'New')));
		this._register(addStandardDisposableListener(newButton, 'click', () => {
			this.createNewWorkflow();
		}));

		// Save button
		const saveButton = append(this.toolbarContainer, $('button.toolbar-button', {}, localize('save', 'Save')));
		this._register(addStandardDisposableListener(saveButton, 'click', () => {
			this.saveCurrentWorkflow();
		}));

		// Execute button
		const executeButton = append(this.toolbarContainer, $('button.toolbar-button.execute', {}, localize('execute', 'Execute')));
		this._register(addStandardDisposableListener(executeButton, 'click', () => {
			this.executeCurrentWorkflow();
		}));

		// Zoom controls
		const zoomOut = append(this.toolbarContainer, $('button.toolbar-button', {}, '−'));
		this._register(addStandardDisposableListener(zoomOut, 'click', () => {
			this.setZoom(this.zoom - 0.1);
		}));

		const zoomLevel = append(this.toolbarContainer, $('span.zoom-level', {}, `${Math.round(this.zoom * 100)}%`));

		const zoomIn = append(this.toolbarContainer, $('button.toolbar-button', {}, '+'));
		this._register(addStandardDisposableListener(zoomIn, 'click', () => {
			this.setZoom(this.zoom + 0.1);
		}));

		// Delete button
		const deleteButton = append(this.toolbarContainer, $('button.toolbar-button.delete', {}, localize('delete', 'Delete')));
		this._register(addStandardDisposableListener(deleteButton, 'click', () => {
			this.deleteCurrentWorkflow();
		}));
	}

	private renderPalette(): void {
		this.paletteContainer = append(this.container, $('.workflow-palette'));
		append(this.paletteContainer, $('h3.palette-title', {}, localize('nodes', 'Nodes')));

		for (const item of this.paletteItems) {
			const paletteItem = append(this.paletteContainer, $(`.palette-item`, { draggable: 'true' }));
			paletteItem.title = item.description;
			paletteItem.innerHTML = `${item.icon} ${item.label}`;
			paletteItem.dataset.type = item.type;

			this._register(addStandardDisposableListener(paletteItem, 'dragstart', (e) => {
				e.dataTransfer?.setData('nodeType', item.type);
			}));
		}
	}

	private renderCanvas(): void {
		const canvasWrapper = append(this.container, $('.canvas-wrapper'));

		this.canvasContainer = append(canvasWrapper, $('.workflow-canvas'));
		this.canvasContainer.style.transform = `scale(${this.zoom})`;

		this._register(addStandardDisposableListener(this.canvasContainer, 'dragover', (e) => {
			e.preventDefault();
		}));

		this._register(addStandardDisposableListener(this.canvasContainer, 'drop', (e) => {
			this.handleCanvasDrop(e);
		}));

		this._register(addStandardDisposableListener(this.canvasContainer, 'click', (e) => {
			if (e.target === this.canvasContainer) {
				this.clearSelection();
			}
		}));
	}

	private renderPropertiesPanel(): void {
		this.propertiesContainer = append(this.container, $('.properties-panel'));
		append(this.propertiesContainer, $('h3.properties-title', {}, localize('properties', 'Properties')));

		this.updatePropertiesPanel();
	}

	private updatePropertiesPanel(): void {
		this.propertiesContainer.innerHTML = '';
		append(this.propertiesContainer, $('h3.properties-title', {}, localize('properties', 'Properties')));

		if (this.selectedNode) {
			this.renderNodeProperties(this.selectedNode);
		} else if (this.selectedEdge) {
			this.renderEdgeProperties(this.selectedEdge);
		} else if (this.currentWorkflow) {
			this.renderWorkflowProperties(this.currentWorkflow);
		} else {
			append(this.propertiesContainer, $('div.empty-properties', {}, localize('selectItem', 'Select an item to view properties')));
		}
	}

	private renderNodeProperties(node: IWorkflowNode): void {
		// Node name
		const nameGroup = append(this.propertiesContainer, $('.property-group'));
		append(nameGroup, $('label', {}, localize('name', 'Name')));
		const nameInput = append(nameGroup, $('input.property-input', { value: node.label }));
		this._register(addStandardDisposableListener(nameInput, 'change', () => {
			this.updateNodeLabel(node.id, nameInput.value);
		}));

		// Node type
		const typeGroup = append(this.propertiesContainer, $('.property-group'));
		append(typeGroup, $('label', {}, localize('type', 'Type')));
		append(typeGroup, $('span.property-value', {}, node.type));

		// Status
		const statusGroup = append(this.propertiesContainer, $('.property-group'));
		append(statusGroup, $('label', {}, localize('status', 'Status')));
		append(statusGroup, $('span.property-value', {}, node.status));

		// Config based on type
		if (node.type === 'agent' || node.type === 'tool') {
			const configGroup = append(this.propertiesContainer, $('.property-group'));
			const id = node.type === 'agent' ? 'agentId' : 'toolId';
			append(configGroup, $('label', {}, localize('id', 'ID')));
			const idInput = append(configGroup, $('input.property-input', { value: node.config[id] || '' }));
			this._register(addStandardDisposableListener(idInput, 'change', () => {
				this.updateNodeConfig(node.id, id, idInput.value);
			}));
		}

		if (node.type === 'loop' || node.type === 'retry') {
			const configGroup = append(this.propertiesContainer, $('.property-group'));
			const maxKey = node.type === 'loop' ? 'maxIterations' : 'retryCount';
			append(configGroup, $('label', {}, localize('maxCount', 'Max')));
			const maxInput = append(configGroup, $('input.property-input', { type: 'number', value: String(node.config[maxKey] || 10) }));
			this._register(addStandardDisposableListener(maxInput, 'change', () => {
				this.updateNodeConfig(node.id, maxKey, parseInt(maxInput.value)));
			}));
		}

		// Delete button
		const deleteButton = append(this.propertiesContainer, $('button.delete-node-button', {}, localize('deleteNode', 'Delete Node')));
		this._register(addStandardDisposableListener(deleteButton, 'click', () => {
			this.deleteNode(node.id);
		}));
	}

	private renderEdgeProperties(edge: IWorkflowEdge): void {
		const sourceGroup = append(this.propertiesContainer, $('.property-group'));
		append(sourceGroup, $('label', {}, localize('source', 'Source')));
		append(sourceGroup, $('span.property-value', {}, edge.sourceId));

		const targetGroup = append(this.propertiesContainer, $('.property-group'));
		append(targetGroup, $('label', {}, localize('target', 'Target')));
		append(targetGroup, $('span.property-value', {}, edge.targetId));

		const conditionGroup = append(this.propertiesContainer, $('.property-group'));
		append(conditionGroup, $('label', {}, localize('condition', 'Condition')));
		const conditionInput = append(conditionGroup, $('input.property-input', { value: edge.condition || '' }));
		this._register(addStandardDisposableListener(conditionInput, 'change', () => {
			this.updateEdgeCondition(edge.id, conditionInput.value);
		}));
	}

	private renderWorkflowProperties(workflow: IWorkflowGraph): void {
		const nameGroup = append(this.propertiesContainer, $('.property-group'));
		append(nameGroup, $('label', {}, localize('name', 'Name')));
		const nameInput = append(nameGroup, $('input.property-input', { value: workflow.name }));
		this._register(addStandardDisposableListener(nameInput, 'change', () => {
			this.updateWorkflowName(workflow.id, nameInput.value);
		}));

		const descGroup = append(this.propertiesContainer, $('.property-group'));
		append(descGroup, $('label', {}, localize('description', 'Description')));
		const descInput = append(descGroup, $('textarea.property-textarea', {}, workflow.description || ''));
		this._register(addStandardDisposableListener(descInput, 'change', () => {
			this.updateWorkflowDescription(workflow.id, descInput.value);
		}));

		const statusGroup = append(this.propertiesContainer, $('.property-group'));
		append(statusGroup, $('label', {}, localize('status', 'Status')));
		append(statusGroup, $('span.property-value', {}, workflow.status));

		const nodesGroup = append(this.propertiesContainer, $('.property-group'));
		append(nodesGroup, $('label', {}, localize('nodes', 'Nodes')));
		append(nodesGroup, $('span.property-value', {}, String(workflow.nodes.length)));

		const edgesGroup = append(this.propertiesContainer, $('.property-group'));
		append(edgesGroup, $('label', {}, localize('connections', 'Connections')));
		append(edgesGroup, $('span.property-value', {}, String(workflow.edges.length)));
	}

	private setupCanvasEventListeners(): void {
		this._register(addStandardDisposableListener(this.canvasContainer, 'mousedown', (e) => {
			const target = e.target as HTMLElement;
			if (target.classList.contains('workflow-node')) {
				const nodeId = target.dataset.nodeId;
				const node = this.currentWorkflow?.nodes.find(n => n.id === nodeId);
				if (node) {
					this.selectNode(node);
					this.isDragging = true;
					const rect = target.getBoundingClientRect();
					this.dragOffset = {
						x: e.clientX - rect.left,
						y: e.clientY - rect.top,
					};
				}
			} else if (target.classList.contains('workflow-edge')) {
				const edgeId = target.dataset.edgeId;
				const edge = this.currentWorkflow?.edges.find(e => e.id === edgeId);
				if (edge) {
					this.selectEdge(edge);
				}
			}
		}));

		this._register(addStandardDisposableListener(this.canvasContainer, 'mousemove', (e) => {
			if (this.isDragging && this.selectedNode) {
				const canvasRect = this.canvasContainer.getBoundingClientRect();
				const newX = (e.clientX - canvasRect.left - this.dragOffset.x) / this.zoom;
				const newY = (e.clientY - canvasRect.top - this.dragOffset.y) / this.zoom;
				this.moveNode(this.selectedNode.id, newX, newY);
			}
		}));

		this._register(addStandardDisposableListener(this.canvasContainer, 'mouseup', () => {
			this.isDragging = false;
		}));

		// Double-click to create node
		this._register(addStandardDisposableListener(this.canvasContainer, 'dblclick', (e) => {
			const target = e.target as HTMLElement;
			if (target === this.canvasContainer) {
				const canvasRect = this.canvasContainer.getBoundingClientRect();
				const x = (e.clientX - canvasRect.left) / this.zoom;
				const y = (e.clientY - canvasRect.top) / this.zoom;
				this.addNode('sequential', x, y);
			}
		}));

		// Right-click context menu
		this._register(addStandardDisposableListener(this.canvasContainer, 'contextmenu', (e) => {
			e.preventDefault();
			// TODO: Show context menu
		}));
	}

	private handleCanvasDrop(e: DragEvent): void {
		e.preventDefault();
		const nodeType = e.dataTransfer?.getData('nodeType');
		if (!nodeType || !this.currentWorkflow) {
			return;
		}

		const canvasRect = this.canvasContainer.getBoundingClientRect();
		const x = (e.clientX - canvasRect.left) / this.zoom;
		const y = (e.clientY - canvasRect.top) / this.zoom;

		this.addNode(nodeType as WorkflowNodeType, x, y);
	}

	private loadWorkflows(): void {
		const stored = this.storageService.get(WorkflowDesignerView.WORKFLOWS_STORE_KEY, 0);
		if (stored) {
			try {
				const workflows = JSON.parse(stored) as IWorkflowGraph[];
				for (const wf of workflows) {
					this.workflows.set(wf.id, wf);
				}
			} catch {
				this.logService.error('Failed to load workflows');
			}
		}
	}

	private createNewWorkflow(): void {
		const id = `workflow-${Date.now()}`;
		const workflow: IWorkflowGraph = {
			id,
			name: localize('newWorkflow', 'New Workflow'),
			nodes: [],
			edges: [],
			status: 'created',
			createdAt: Date.now(),
			version: 1,
		};

		this.workflows.set(id, workflow);
		this.loadWorkflow(id);
		this.updateWorkflowSelector();
	}

	private loadWorkflow(workflowId: string): void {
		const workflow = this.workflows.get(workflowId);
		if (workflow) {
			this.currentWorkflow = workflow;
			this.renderCanvasContent();
			this.updatePropertiesPanel();
			this.updateWorkflowSelector(workflowId);
		}
	}

	private saveCurrentWorkflow(): void {
		if (!this.currentWorkflow) {
			return;
		}

		this.workflows.set(this.currentWorkflow.id, this.currentWorkflow);
		const workflows = Array.from(this.workflows.values());
		this.storageService.store(WorkflowDesignerView.WORKFLOWS_STORE_KEY, JSON.stringify(workflows), 0);

		this.logService.info(`Workflow ${this.currentWorkflow.name} saved`);
	}

	private async executeCurrentWorkflow(): Promise<void> {
		if (!this.currentWorkflow) {
			return;
		}

		try {
			const result = await this.workflowEngine.executeWorkflow(this.currentWorkflow.id);
			this.logService.info(`Workflow ${this.currentWorkflow.name} execution started`);
		} catch (error) {
			this.logService.error(`Workflow execution failed: ${error}`);
		}
	}

	private deleteCurrentWorkflow(): void {
		if (!this.currentWorkflow) {
			return;
		}

		this.workflows.delete(this.currentWorkflow.id);
		this.currentWorkflow = undefined;
		this.clearCanvas();
		this.updateWorkflowSelector();
		this.updatePropertiesPanel();
	}

	private renderCanvasContent(): void {
		this.canvasContainer.innerHTML = '';

		if (!this.currentWorkflow) {
			return;
		}

		// Render edges first (behind nodes)
		for (const edge of this.currentWorkflow.edges) {
			this.renderEdge(edge);
		}

		// Render nodes
		for (const node of this.currentWorkflow.nodes) {
			this.renderNode(node);
		}
	}

	private renderNode(node: IWorkflowNode): void {
		const nodeElement = append(this.canvasContainer, $(`.workflow-node node-${node.status}`, {
			style: `left: ${node.position.x}px; top: ${node.position.y}px;`,
		}));
		nodeElement.dataset.nodeId = node.id;

		const icon = append(nodeElement, $('.node-icon', {}, this.getNodeIcon(node.type)));
		append(nodeElement, $('.node-label', {}, node.label));

		this._register(addStandardDisposableListener(nodeElement, 'click', () => {
			this.selectNode(node);
		}));
	}

	private renderEdge(edge: IWorkflowEdge): void {
		const sourceNode = this.currentWorkflow?.nodes.find(n => n.id === edge.sourceId);
		const targetNode = this.currentWorkflow?.nodes.find(n => n.id === edge.targetId);

		if (!sourceNode || !targetNode) {
			return;
		}

		const x1 = sourceNode.position.x + 75;
		const y1 = sourceNode.position.y + 30;
		const x2 = targetNode.position.x + 75;
		const y2 = targetNode.position.y + 30;

		const path = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		path.setAttribute('class', 'workflow-edge-svg');
		path.setAttribute('width', '100%');
		path.setAttribute('height', '100%');
		path.style.position = 'absolute';
		path.style.pointerEvents = 'none';

		const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		const d = `M ${x1} ${y1} C ${x1 + 50} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`;
		line.setAttribute('d', d);
		line.setAttribute('class', `workflow-edge ${edge.status}`);
		line.setAttribute('marker-end', 'url(#arrowhead)');

		path.appendChild(line);
		this.canvasContainer.appendChild(path);
	}

	private addNode(type: WorkflowNodeType, x: number, y: number): void {
		if (!this.currentWorkflow) {
			return;
		}

		const node: IWorkflowNode = {
			id: `node-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			type,
			label: this.getNodeLabel(type),
			position: { x, y },
			config: {},
			status: 'pending',
		};

		this.currentWorkflow.nodes.push(node);
		this.renderNode(node);
		this.selectNode(node);
		this._onDidChange.fire();
	}

	private moveNode(nodeId: string, x: number, y: number): void {
		if (!this.currentWorkflow) {
			return;
		}

		const node = this.currentWorkflow.nodes.find(n => n.id === nodeId);
		if (node) {
			node.position = { x, y };
			this.renderCanvasContent();
			this.selectNode(node);
		}
	}

	private deleteNode(nodeId: string): void {
		if (!this.currentWorkflow) {
			return;
		}

		this.currentWorkflow.nodes = this.currentWorkflow.nodes.filter(n => n.id !== nodeId);
		this.currentWorkflow.edges = this.currentWorkflow.edges.filter(e => e.sourceId !== nodeId && e.targetId !== nodeId);

		this.renderCanvasContent();
		this.clearSelection();
		this._onDidChange.fire();
	}

	private updateNodeLabel(nodeId: string, label: string): void {
		if (!this.currentWorkflow) {
			return;
		}

		const node = this.currentWorkflow.nodes.find(n => n.id === nodeId);
		if (node) {
			node.label = label;
			this.renderNode(node);
		}
	}

	private updateNodeConfig(nodeId: string, key: string, value: unknown): void {
		if (!this.currentWorkflow) {
			return;
		}

		const node = this.currentWorkflow.nodes.find(n => n.id === nodeId);
		if (node) {
			node.config = { ...node.config, [key]: value };
		}
	}

	private updateEdgeCondition(edgeId: string, condition: string): void {
		if (!this.currentWorkflow) {
			return;
		}

		const edge = this.currentWorkflow.edges.find(e => e.id === edgeId);
		if (edge) {
			edge.condition = condition;
			this.renderCanvasContent();
		}
	}

	private updateWorkflowName(workflowId: string, name: string): void {
		const workflow = this.workflows.get(workflowId);
		if (workflow) {
			workflow.name = name;
			this.updateWorkflowSelector(workflowId);
		}
	}

	private updateWorkflowDescription(workflowId: string, description: string): void {
		const workflow = this.workflows.get(workflowId);
		if (workflow) {
			workflow.description = description;
		}
	}

	private selectNode(node: IWorkflowNode): void {
		this.clearSelection();
		this.selectedNode = node;
		this.selectedEdge = undefined;

		const nodeElement = this.canvasContainer.querySelector(`[data-node-id="${node.id}"]`) as HTMLElement;
		if (nodeElement) {
			nodeElement.classList.add('selected');
		}

		this.updatePropertiesPanel();
	}

	private selectEdge(edge: IWorkflowEdge): void {
		this.clearSelection();
		this.selectedEdge = edge;
		this.selectedNode = undefined;

		const edgeElement = this.canvasContainer.querySelector(`[data-edge-id="${edge.id}"]`) as HTMLElement;
		if (edgeElement) {
			edgeElement.classList.add('selected');
		}

		this.updatePropertiesPanel();
	}

	private clearSelection(): void {
		this.selectedNode = undefined;
		this.selectedEdge = undefined;

		const selected = this.canvasContainer.querySelectorAll('.selected');
		selected.forEach(el => el.classList.remove('selected'));

		this.updatePropertiesPanel();
	}

	private clearCanvas(): void {
		this.canvasContainer.innerHTML = '';
		this.clearSelection();
	}

	private setZoom(level: number): void {
		this.zoom = Math.max(0.25, Math.min(2, level));
		this.canvasContainer.style.transform = `scale(${this.zoom})`;
	}

	private updateWorkflowSelector(selectedId?: string): void {
		const selector = this.toolbarContainer?.querySelector('.workflow-selector') as HTMLSelectElement;
		if (!selector) {
			return;
		}

		selector.innerHTML = '<option value="">-- Select Workflow --</option>';
		for (const [id, workflow] of this.workflows) {
			const option = append(selector, $('option', { value: id }, workflow.name));
			if (id === selectedId) {
				option.selected = true;
			}
		}
	}

	private getNodeIcon(type: WorkflowNodeType): string {
		const item = this.paletteItems.find(i => i.type === type);
		return item?.icon || '●';
	}

	private getNodeLabel(type: WorkflowNodeType): string {
		const item = this.paletteItems.find(i => i.type === type);
		return item?.label || type;
	}

	public override dispose(): void {
		this._register.dispose();
		super.dispose();
	}
}

import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
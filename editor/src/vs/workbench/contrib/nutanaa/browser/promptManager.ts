/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import {
	IPromptTemplate,
	IPromptVariable,
	IPromptRenderOptions,
	IPromptRenderResult,
	IPromptValidationResult,
} from '../models/aiCore.js';
import { IPromptManager } from '../common/promptManager.js';
import { IRuntimeEventBus, RuntimeEventType } from '../common/runtimeEventBus.js';
import { IRuntimeStateService } from '../common/runtimeState.js';

/**
 * PromptManager implementation for Nutanaa Studio OS.
 *
 * Manages prompt templates with versioning, variable substitution,
 * rendering, and validation.
 */
export class PromptManager extends Disposable implements IPromptManager {

	declare readonly _serviceBrand: undefined;

	private readonly templates = new Map<string, IPromptTemplate>();
	private readonly templateVersions = new Map<string, IPromptTemplate[]>();

	private readonly _onDidChangeTemplates = this._register(new Emitter<void>());
	private readonly _onDidRenderTemplate = this._register(new Emitter<IPromptRenderResult>());

	public readonly onDidChangeTemplates = Event.fromEmitter(this._onDidChangeTemplates);
	public readonly onDidRenderTemplate = Event.fromEmitter(this._onDidRenderTemplate);

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	// ── Template Management ─────────────────────────────────────────────────────

	registerTemplate(template: IPromptTemplate): boolean {
		if (this.templates.has(template.id)) {
			this.logService.warn(`Template ${template.id} already registered`);
			return false;
		}

		this.templates.set(template.id, template);
		this.templateVersions.set(template.id, [template]);

		// Update runtime state
		this.runtimeStateService.updateProviders({
			addedPrompts: [template],
		});

		// Fire event
		this._onDidChangeTemplates.fire();

		this.logService.info(`Template ${template.name} (${template.id}) v${template.version} registered`);
		return true;
	}

	unregisterTemplate(templateId: string): boolean {
		const template = this.templates.get(templateId);
		if (!template) {
			this.logService.warn(`Template ${templateId} not found for unregistration`);
			return false;
		}

		this.templates.delete(templateId);
		this.templateVersions.delete(templateId);

		// Update runtime state
		this.runtimeStateService.updateProviders({
			removedPrompts: [templateId],
		});

		// Fire event
		this._onDidChangeTemplates.fire();

		this.logService.info(`Template ${templateId} unregistered`);
		return true;
	}

	updateTemplate(templateId: string, updates: Partial<IPromptTemplate>): number | undefined {
		const template = this.templates.get(templateId);
		if (!template) {
			this.logService.warn(`Template ${templateId} not found for update`);
			return undefined;
		}

		const versions = this.templateVersions.get(templateId) ?? [];
		const newVersion = template.version + 1;

		const newTemplate: IPromptTemplate = {
			...template,
			...updates,
			version: newVersion,
			updatedAt: Date.now(),
		};

		this.templates.set(templateId, newTemplate);
		versions.push(newTemplate);
		this.templateVersions.set(templateId, versions);

		// Update runtime state
		this.runtimeStateService.updateProviders({
			updatedPrompts: [newTemplate],
		});

		// Fire event
		this._onDidChangeTemplates.fire();

		this.logService.info(`Template ${templateId} updated to v${newVersion}`);
		return newVersion;
	}

	getAllTemplates(): IPromptTemplate[] {
		return Array.from(this.templates.values());
	}

	getTemplate(templateId: string): IPromptTemplate | undefined {
		return this.templates.get(templateId);
	}

	getTemplateByName(name: string): IPromptTemplate | undefined {
		for (const template of this.templates.values()) {
			if (template.name === name) {
				return template;
			}
		}
		return undefined;
	}

	getTemplatesByTags(tags: string[]): IPromptTemplate[] {
		const results: IPromptTemplate[] = [];

		for (const template of this.templates.values()) {
			if (tags.some(tag => template.tags.includes(tag))) {
				results.push(template);
			}
		}

		return results;
	}

	getLatestVersion(templateId: string): IPromptTemplate | undefined {
		return this.templates.get(templateId);
	}

	getVersion(templateId: string, version: number): IPromptTemplate | undefined {
		const versions = this.templateVersions.get(templateId);
		return versions?.find(v => v.version === version);
	}

	getAllVersions(templateId: string): IPromptTemplate[] {
		return (this.templateVersions.get(templateId) ?? []).slice().sort((a, b) => a.version - b.version);
	}

	// ── Variable Management ────────────────────────────────────────────────────

	getVariables(templateId: string): IPromptVariable[] {
		const template = this.templates.get(templateId);
		return template?.variables ?? [];
	}

	validateVariables(templateId: string, values: Record<string, string>): IPromptValidationResult {
		const template = this.templates.get(templateId);
		if (!template) {
			return {
				valid: false,
				errors: ['Template not found'],
				warnings: [],
			};
		}

		const errors: string[] = [];
		const warnings: string[] = [];

		// Check required variables
		for (const variable of template.variables) {
			if (variable.required && !(variable.name in values)) {
				errors.push(`Required variable '${variable.name}' is missing`);
			}

			// Check validation pattern
			if (variable.validationPattern && values[variable.name]) {
				try {
					const regex = new RegExp(variable.validationPattern);
					if (!regex.test(values[variable.name])) {
						errors.push(`Variable '${variable.name}' does not match required pattern`);
					}
				} catch {
					warnings.push(`Invalid validation pattern for variable '${variable.name}'`);
				}
			}
		}

		// Check for extra values
		const validNames = new Set(template.variables.map(v => v.name));
		for (const name of Object.keys(values)) {
			if (!validNames.has(name)) {
				warnings.push(`Unknown variable '${name}'`);
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	// ── Rendering ─────────────────────────────────────────────────────────────

	render(templateId: string, options: IPromptRenderOptions): IPromptRenderResult {
		const template = this.templates.get(templateId);
		if (!template) {
			return {
				systemPrompt: '',
				userPrompt: '',
				renderedAt: Date.now(),
				tokenCount: 0,
				warnings: [`Template ${templateId} not found`],
			};
		}

		return this.renderTemplate(template, options);
	}

	renderTemplate(template: IPromptTemplate, options: IPromptRenderOptions): IPromptRenderResult {
		const warnings: string[] = [];
		const tokenCount = this.estimateTokenCount(
			`${options.includeSystemPrompt ? template.systemPrompt : ''} ` +
			`${options.includeDeveloperPrompt && template.developerPrompt ? template.developerPrompt : ''} ` +
			`${template.userPromptTemplate}`
		);

		const systemPrompt = options.includeSystemPrompt
			? this.substituteVariables(template.systemPrompt, options.variables, warnings)
			: '';

		const developerPrompt = options.includeDeveloperPrompt && template.developerPrompt
			? this.substituteVariables(template.developerPrompt, options.variables, warnings)
			: undefined;

		const userPrompt = this.substituteVariables(template.userPromptTemplate, options.variables, warnings);

		const result: IPromptRenderResult = {
			systemPrompt,
			developerPrompt,
			userPrompt,
			renderedAt: Date.now(),
			tokenCount,
			warnings,
		};

		// Fire event
		this._onDidRenderTemplate.fire(result);
		this.runtimeEventBus.fire({
			type: RuntimeEventType.PromptRendered,
			timestamp: Date.now(),
			payload: {
				promptId: template.id,
				promptName: template.name,
				tokenCount,
				variables: options.variables,
			},
		});

		return result;
	}

	preview(templateId: string, variables: Record<string, string> = {}): string {
		const template = this.templates.get(templateId);
		if (!template) {
			return `Template ${templateId} not found`;
		}

		const warnings: string[] = [];
		let preview = this.substituteVariables(template.userPromptTemplate, variables, warnings);

		if (template.developerPrompt) {
			preview = `${this.substituteVariables(template.developerPrompt, variables, warnings)}\n\n${preview}`;
		}

		return preview;
	}

	// ── Validation ────────────────────────────────────────────────────────────

	validateTemplate(template: IPromptTemplate): IPromptValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Check for required fields
		if (!template.id) {
			errors.push('Template ID is required');
		}
		if (!template.name) {
			errors.push('Template name is required');
		}
		if (!template.systemPrompt && !template.userPromptTemplate) {
			errors.push('At least one of systemPrompt or userPromptTemplate is required');
		}

		// Check for circular variable references
		const variableNames = new Set(template.variables.map(v => v.name));
		for (const variable of template.variables) {
			if (variable.defaultValue) {
				const matches = variable.defaultValue.match(/\{\{(\w+)\}\}/g);
				if (matches) {
					for (const match of matches) {
						const refName = match.slice(2, -2);
						if (!variableNames.has(refName)) {
							warnings.push(`Variable '${variable.name}' references undefined variable '${refName}'`);
						}
					}
				}
			}
		}

		// Validate variable patterns
		for (const variable of template.variables) {
			if (variable.validationPattern) {
				try {
					new RegExp(variable.validationPattern);
				} catch {
					errors.push(`Invalid validation pattern for variable '${variable.name}'`);
				}
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private substituteVariables(
		template: string,
		variables: Record<string, string>,
		warnings: string[]
	): string {
		return template.replace(/\{\{(\w+)\}\}/g, (match, name) => {
			if (name in variables) {
				return variables[name];
			}
			warnings.push(`Variable '${name}' not provided, keeping placeholder`);
			return match;
		});
	}

	private estimateTokenCount(text: string): number {
		// Rough estimate: 4 characters per token on average
		return Math.ceil(text.length / 4);
	}
}
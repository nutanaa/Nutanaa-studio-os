/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import {
	IPromptTemplate,
	IPromptVariable,
	IPromptRenderOptions,
	IPromptRenderResult,
	IPromptValidationResult,
} from '../models/aiCore.js';

/**
 * Service for managing prompt templates in Nutanaa Studio OS.
 *
 * Responsibilities:
 * - Prompt template management
 * - Variable substitution
 * - Template rendering
 * - Versioning
 * - Validation
 */
export const IPromptManager = createDecorator<IPromptManager>('nutanaaPromptManager');

export interface IPromptManager {

	// ── Template Management ─────────────────────────────────────────────────────

	/**
	 * Register a new prompt template.
	 * @param template The prompt template
	 * @returns True if registration succeeded
	 */
	registerTemplate(template: IPromptTemplate): boolean;

	/**
	 * Unregister a prompt template by ID.
	 * @param templateId The template ID
	 * @returns True if unregistration succeeded
	 */
	unregisterTemplate(templateId: string): boolean;

	/**
	 * Update a prompt template (creates new version).
	 * @param templateId The template ID
	 * @param updates Partial template updates
	 * @returns New version number or undefined
	 */
	updateTemplate(templateId: string, updates: Partial<IPromptTemplate>): number | undefined;

	/**
	 * Get all registered templates.
	 * @returns Array of all templates
	 */
	getAllTemplates(): IPromptTemplate[];

	/**
	 * Get template by ID.
	 * @param templateId The template ID
	 * @returns Template or undefined
	 */
	getTemplate(templateId: string): IPromptTemplate | undefined;

	/**
	 * Get template by name.
	 * @param name The template name
	 * @returns Template or undefined
	 */
	getTemplateByName(name: string): IPromptTemplate | undefined;

	/**
	 * Get templates by tags.
	 * @param tags Array of tags
	 * @returns Matching templates
	 */
	getTemplatesByTags(tags: string[]): IPromptTemplate[];

	/**
	 * Get the latest version of a template.
	 * @param templateId The template ID
	 * @returns Latest version or undefined
	 */
	getLatestVersion(templateId: string): IPromptTemplate | undefined;

	/**
	 * Get a specific version of a template.
	 * @param templateId The template ID
	 * @param version The version number
	 * @returns Template version or undefined
	 */
	getVersion(templateId: string, version: number): IPromptTemplate | undefined;

	/**
	 * Get all versions of a template.
	 * @param templateId The template ID
	 * @returns All versions sorted by version number
	 */
	getAllVersions(templateId: string): IPromptTemplate[];

	// ── Variable Management ────────────────────────────────────────────────────

	/**
	 * Get variables for a template.
	 * @param templateId The template ID
	 * @returns Array of variables
	 */
	getVariables(templateId: string): IPromptVariable[];

	/**
	 * Validate variable values against template requirements.
	 * @param templateId The template ID
	 * @param values Variable values
	 * @returns Validation result
	 */
	validateVariables(templateId: string, values: Record<string, string>): IPromptValidationResult;

	// ── Rendering ─────────────────────────────────────────────────────────────

	/**
	 * Render a prompt template with variables.
	 * @param templateId The template ID
	 * @param options Render options including variables
	 * @returns Rendered result
	 */
	render(templateId: string, options: IPromptRenderOptions): IPromptRenderResult;

	/**
	 * Render a template directly without registration.
	 * @param template The template to render
	 * @param options Render options
	 * @returns Rendered result
	 */
	renderTemplate(template: IPromptTemplate, options: IPromptRenderOptions): IPromptRenderResult;

	/**
	 * Preview a template with placeholder values.
	 * @param templateId The template ID
	 * @param variables Variable values (or empty for placeholders)
	 * @returns Preview string
	 */
	preview(templateId: string, variables?: Record<string, string>): string;

	// ── Validation ────────────────────────────────────────────────────────────

	/**
	 * Validate a prompt template.
	 * @param template The template to validate
	 * @returns Validation result
	 */
	validateTemplate(template: IPromptTemplate): IPromptValidationResult;

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when templates are registered or unregistered.
	 */
	onDidChangeTemplates: (listener: () => void) => { dispose(): void };

	/**
	 * Event fired when a template is rendered.
	 */
	onDidRenderTemplate: (listener: (result: IPromptRenderResult) => void) => { dispose(): void };
}
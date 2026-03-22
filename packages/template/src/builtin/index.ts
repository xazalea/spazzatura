/**
 * Built-in templates for Spazzatura
 * Provides commonly used templates out of the box
 */

import type { BuiltinTemplate, Template } from '../types.js';
import { reactComponent } from './react-component.js';
import { vueComponent } from './vue-component.js';
import { apiRoute } from './api-route.js';
import { testFile } from './test-file.js';
import { cliCommand } from './cli-command.js';
import { readme } from './readme.js';
import { license } from './license.js';
import { githubAction } from './github-action.js';

/**
 * All built-in templates
 */
export const builtinTemplates: BuiltinTemplate[] = [
  reactComponent,
  vueComponent,
  apiRoute,
  testFile,
  cliCommand,
  readme,
  license,
  githubAction,
];

/**
 * Get a built-in template by ID or name
 */
export function getBuiltinTemplate(id: string): Template | undefined {
  const found = builtinTemplates.find(
    (t) => t.id === id || t.template.name === id || t.aliases?.includes(id)
  );
  return found?.template;
}

/**
 * List all built-in template IDs
 */
export function listBuiltinTemplates(): string[] {
  return builtinTemplates.map((t) => t.id);
}

/**
 * Register all built-in templates with a template manager
 */
export function registerBuiltinTemplates(register: (template: Template) => void): void {
  for (const { template } of builtinTemplates) {
    register(template);
  }
}

// Re-export individual templates
export { reactComponent } from './react-component.js';
export { vueComponent } from './vue-component.js';
export { apiRoute } from './api-route.js';
export { testFile } from './test-file.js';
export { cliCommand } from './cli-command.js';
export { readme } from './readme.js';
export { license } from './license.js';
export { githubAction } from './github-action.js';

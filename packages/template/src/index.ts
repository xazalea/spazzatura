/**
 * @spazzatura/template
 * Template engine for Spazzatura
 */

// Types
export * from './types.js';

// Core components
export { TemplateEngine } from './engine.js';
export { TemplateManager } from './manager.js';
export { TemplateLoader } from './loader.js';
export { TemplateValidator } from './validator.js';
export { HistoryManager, TransactionHistoryManager } from './history.js';
export { ConsolePromptAdapter, PromptManager } from './prompts.js';

// Built-in templates
export {
  builtinTemplates,
  getBuiltinTemplate,
  listBuiltinTemplates,
  registerBuiltinTemplates,
  reactComponent,
  vueComponent,
  apiRoute,
  testFile,
  cliCommand,
  readme,
  license,
  githubAction,
} from './builtin/index.js';

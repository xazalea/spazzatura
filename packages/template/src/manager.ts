/**
 * Template manager implementation for Spazzatura
 * Handles template registration, generation, and undo/redo
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ITemplateManager,
  Template,
  TemplateId,
  TemplateFilter,
  GenerationResult,
  GeneratedFile,
  GenerateOptions,
  PromptOptions,
  PromptResult,
  TemplateContext,
  TemplateFile,
} from './types.js';
import { TemplateEngine } from './engine.js';
import { HistoryManager, generateId } from './history.js';

/**
 * Template manager implementation
 */
export class TemplateManager implements ITemplateManager {
  private templates: Map<TemplateId, Template> = new Map();
  private aliases: Map<string, TemplateId> = new Map();
  private engine: TemplateEngine;
  private history: HistoryManager;
  
  constructor() {
    this.engine = new TemplateEngine();
    this.history = new HistoryManager();
  }
  
  /**
   * Register a template
   */
  register(template: Template): void {
    const id = template.id ?? template.name;
    
    // Check for existing template
    if (this.templates.has(id)) {
      throw new Error(`Template with ID "${id}" is already registered`);
    }
    
    // Store the template
    this.templates.set(id, template);
    
    // Register aliases
    if (template.id) {
      this.aliases.set(template.name, template.id);
    }
    
    // Register template helpers
    if (template.format === 'builtin') {
      // Built-in templates can have custom helpers
    }
  }
  
  /**
   * Unregister a template
   */
  unregister(templateId: TemplateId): void {
    const template = this.templates.get(templateId);
    if (!template) {
      return;
    }
    
    this.templates.delete(templateId);
    
    // Remove aliases
    for (const [alias, id] of this.aliases) {
      if (id === templateId) {
        this.aliases.delete(alias);
      }
    }
  }
  
  /**
   * Get a template by ID or name
   */
  get(templateId: TemplateId): Template | undefined {
    // Try direct ID lookup
    let template = this.templates.get(templateId);
    
    // Try alias lookup
    if (!template) {
      const aliasedId = this.aliases.get(templateId);
      if (aliasedId) {
        template = this.templates.get(aliasedId);
      }
    }
    
    return template;
  }
  
  /**
   * List all registered templates
   */
  list(): TemplateId[] {
    return Array.from(this.templates.keys());
  }
  
  /**
   * Search templates with filter
   */
  search(filter: TemplateFilter): Template[] {
    let results = Array.from(this.templates.values());
    
    // Filter by tags
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter((t) => 
        t.tags?.some((tag) => filter.tags!.includes(tag))
      );
    }
    
    // Filter by author
    if (filter.author) {
      results = results.filter((t) => t.author === filter.author);
    }
    
    // Filter by category
    if (filter.category) {
      results = results.filter((t) => t.category === filter.category);
    }
    
    // Filter by search query
    if (filter.query) {
      const query = filter.query.toLowerCase();
      results = results.filter((t) => 
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
        t.keywords?.some((keyword) => keyword.toLowerCase().includes(query))
      );
    }
    
    return results;
  }
  
  /**
   * Generate files from a template
   */
  async generate(
    templateId: TemplateId,
    variables: Record<string, unknown>,
    options: GenerateOptions = {}
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    
    // Get the template
    const template = this.get(templateId);
    if (!template) {
      throw new Error(`Template "${templateId}" not found`);
    }
    
    // Resolve working directory
    const cwd = options.cwd ?? process.cwd();
    
    // Build context
    const context: TemplateContext = {
      variables,
      cwd,
      dryRun: options.dryRun,
      force: options.force,
    };
    
    // Run beforeGenerate hook
    if (template.hooks?.beforeGenerate) {
      await template.hooks.beforeGenerate({
        templateName: template.name,
        variables,
        files: [],
        cwd,
      });
    }
    
    // Generate files
    const files = await this.generateFiles(template.files, context, options);
    
    // Create generation result
    const result: GenerationResult = {
      id: generateId(),
      template: template.name,
      variables,
      files,
      timestamp: new Date(),
      undone: false,
      cwd,
      duration: Date.now() - startTime,
    };
    
    // Run afterGenerate hook
    if (template.hooks?.afterGenerate) {
      await template.hooks.afterGenerate({
        templateName: template.name,
        variables,
        files,
        cwd,
      });
    }
    
    // Record in history (unless dry run)
    if (!options.dryRun) {
      this.history.record(result);
    }
    
    return result;
  }
  
  /**
   * Preview generation without writing files
   */
  async preview(
    templateId: TemplateId,
    variables: Record<string, unknown>
  ): Promise<GeneratedFile[]> {
    return this.generate(templateId, variables, { dryRun: true })
      .then((result) => result.files);
  }
  
  /**
   * Undo a generation
   */
  async undo(generationId?: string): Promise<void> {
    if (generationId) {
      await this.history.undoById(generationId);
    } else {
      await this.history.undo();
    }
  }
  
  /**
   * Redo a generation
   */
  async redo(generationId?: string): Promise<void> {
    // History manager doesn't support redo by ID, so just redo the last one
    if (generationId) {
      throw new Error('Redo by ID is not supported');
    }
    await this.history.redo();
  }
  
  /**
   * Get generation history
   */
  getHistory(): GenerationResult[] {
    return this.history.getHistory();
  }
  
  /**
   * Prompt for variable values
   */
  async promptForVariables(
    templateId: TemplateId,
    options: PromptOptions = {}
  ): Promise<PromptResult> {
    const template = this.get(templateId);
    if (!template) {
      throw new Error(`Template "${templateId}" not found`);
    }
    
    if (!template.variables || template.variables.length === 0) {
      return {
        variables: {},
        interactive: false,
      };
    }
    
    // If non-interactive mode, use defaults
    if (options.nonInteractive) {
      const variables: Record<string, unknown> = {};
      for (const variable of template.variables) {
        if (variable.required && variable.default === undefined && !options.defaults?.[variable.name]) {
          throw new Error(`Required variable "${variable.name}" has no default value`);
        }
        variables[variable.name] = options.defaults?.[variable.name] ?? variable.default;
      }
      return {
        variables,
        interactive: false,
      };
    }
    
    // Interactive prompting would be handled by prompts.ts
    // For now, return defaults
    const variables: Record<string, unknown> = {};
    const skipped: string[] = [];
    
    for (const variable of template.variables) {
      if (options.skip?.includes(variable.name)) {
        skipped.push(variable.name);
        continue;
      }
      
      // Use provided default or template default
      variables[variable.name] = options.defaults?.[variable.name] ?? variable.default;
    }
    
    return {
      variables,
      interactive: false,
      skipped,
    };
  }
  
  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.history.canUndo();
  }
  
  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.history.canRedo();
  }
  
  /**
   * Clear all templates and history
   */
  clear(): void {
    this.templates.clear();
    this.aliases.clear();
    this.history.clear();
  }
  
  /**
   * Generate files from template file definitions
   */
  private async generateFiles(
    templateFiles: TemplateFile[],
    context: TemplateContext,
    options: GenerateOptions
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    
    for (const templateFile of templateFiles) {
      // Check condition
      if (templateFile.condition) {
        const shouldInclude = this.evaluateCondition(templateFile.condition, context.variables);
        if (!shouldInclude) {
          continue;
        }
      }
      
      // Resolve file path
      const filePath = this.engine.render(templateFile.path, context);
      
      // Get content
      let content: string;
      if (typeof templateFile.content === 'function') {
        content = templateFile.content(context.variables);
      } else {
        content = this.engine.render(templateFile.content, context);
      }
      
      // Check if file exists
      const absolutePath = path.resolve(context.cwd ?? process.cwd(), filePath);
      let originalContent: string | undefined;
      let action: 'create' | 'modify' | 'delete' | 'skip' = 'create';
      
      try {
        const stats = await fs.stat(absolutePath);
        if (stats.isFile()) {
          originalContent = await fs.readFile(absolutePath, 'utf-8');
          action = 'modify';
          
          // Check skipIfExists
          if (templateFile.skipIfExists && !options.force) {
            action = 'skip';
          }
        }
      } catch {
        // File doesn't exist
      }
      
      // Handle write mode
      if (action === 'modify' && templateFile.mode) {
        switch (templateFile.mode) {
          case 'append':
            content = originalContent + '\n' + content;
            break;
          case 'prepend':
            content = content + '\n' + originalContent;
            break;
          case 'overwrite':
            // Content is already set
            break;
          case 'create':
            // Only create if doesn't exist
            if (originalContent !== undefined && !options.force) {
              action = 'skip';
            }
            break;
        }
      }
      
      const generatedFile: GeneratedFile = {
        path: filePath,
        content,
        originalContent,
        action,
      };
      
      // Write file (unless dry run or skip)
      if (!options.dryRun && action !== 'skip') {
        try {
          // Ensure directory exists
          const dir = path.dirname(absolutePath);
          await fs.mkdir(dir, { recursive: true });
          
          // Write file
          await fs.writeFile(absolutePath, content, 'utf-8');
          generatedFile.written = true;
        } catch (error) {
          generatedFile.written = false;
          generatedFile.error = error instanceof Error ? error : new Error(String(error));
        }
      }
      
      files.push(generatedFile);
    }
    
    return files;
  }
  
  /**
   * Evaluate a condition expression
   */
  private evaluateCondition(condition: string, variables: Record<string, unknown>): boolean {
    try {
      // Simple condition evaluation
      // Supports: {{variable === 'value'}}, {{variable}}, etc.
      
      // Remove {{ }} wrapper if present
      let expr = condition.trim();
      if (expr.startsWith('{{') && expr.endsWith('}}')) {
        expr = expr.slice(2, -2).trim();
      }
      
      // Handle comparison operators
      const comparisonMatch = expr.match(/^(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/);
      if (comparisonMatch) {
        const [, left, op, right] = comparisonMatch;
        if (!left || !op || !right) return false;
        
        const leftVal = this.evaluateValue(left.trim(), variables);
        const rightVal = this.evaluateValue(right.trim(), variables);
        
        switch (op) {
          case '===': return leftVal === rightVal;
          case '!==': return leftVal !== rightVal;
          case '==': return leftVal == rightVal; // eslint-disable-line eqeqeq
          case '!=': return leftVal != rightVal; // eslint-disable-line eqeqeq
          case '>=': return Number(leftVal) >= Number(rightVal);
          case '<=': return Number(leftVal) <= Number(rightVal);
          case '>': return Number(leftVal) > Number(rightVal);
          case '<': return Number(leftVal) < Number(rightVal);
          default: return false;
        }
      }
      
      // Simple truthy check
      const value = this.evaluateValue(expr, variables);
      return Boolean(value);
    } catch {
      return false;
    }
  }
  
  /**
   * Evaluate a value (literal or variable)
   */
  private evaluateValue(expression: string, variables: Record<string, unknown>): unknown {
    // String literal
    if ((expression.startsWith("'") && expression.endsWith("'")) ||
        (expression.startsWith('"') && expression.endsWith('"'))) {
      return expression.slice(1, -1);
    }
    
    // Number literal
    if (/^-?\d+(\.\d+)?$/.test(expression)) {
      return Number(expression);
    }
    
    // Boolean literals
    if (expression === 'true') return true;
    if (expression === 'false') return false;
    if (expression === 'null') return null;
    if (expression === 'undefined') return undefined;
    
    // Variable lookup
    const parts = expression.split('.');
    let value: unknown = variables;
    
    for (const part of parts) {
      if (value === null || value === undefined) return undefined;
      if (typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }
}

/**
 * Create a template manager instance
 */
export function createTemplateManager(): ITemplateManager {
  return new TemplateManager();
}

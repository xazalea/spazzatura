/**
 * Template loader implementation for Spazzatura
 * Loads templates from files, npm packages, git repositories, and built-in sources
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ITemplateLoader,
  Template,
  TemplateFile,
  TemplateVariable,
} from './types.js';

/**
 * Template loader implementation
 */
export class TemplateLoader implements ITemplateLoader {
  private cache: Map<string, Template> = new Map();
  
  /**
   * Load template from a file
   */
  async fromFile(filePath: string): Promise<Template> {
    const absolutePath = path.resolve(filePath);
    const cached = this.cache.get(absolutePath);
    if (cached) {
      return cached;
    }
    
    const content = await fs.readFile(absolutePath, 'utf-8');
    const ext = path.extname(absolutePath).toLowerCase();
    
    let template: Template;
    switch (ext) {
      case '.yaml':
      case '.yml':
        template = await this.parseYaml(content);
        break;
      case '.json':
        template = this.parseJson(content);
        break;
      case '.md':
      case '.markdown':
        template = await this.parseMarkdown(content);
        break;
      default:
        throw new Error(`Unsupported template file format: ${ext}`);
    }
    
    // Set source info
    template = {
      ...template,
      source: 'file',
      id: template.id ?? absolutePath,
    };
    
    this.cache.set(absolutePath, template);
    return template;
  }
  
  /**
   * Load template from a string
   */
  async fromString(content: string, format: 'yaml' | 'json' | 'markdown' = 'yaml'): Promise<Template> {
    switch (format) {
      case 'yaml':
        return this.parseYaml(content);
      case 'json':
        return this.parseJson(content);
      case 'markdown':
        return this.parseMarkdown(content);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
  
  /**
   * Load template from a URL
   */
  async fromUrl(url: string): Promise<Template> {
    const cached = this.cache.get(url);
    if (cached) {
      return cached;
    }
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch template from ${url}: ${response.statusText}`);
      }
      
      const content = await response.text();
      const format = this.detectFormatFromUrl(url);
      
      let template: Template;
      switch (format) {
        case 'yaml':
          template = await this.parseYaml(content);
          break;
        case 'json':
          template = this.parseJson(content);
          break;
        case 'markdown':
          template = await this.parseMarkdown(content);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
      
      template = {
        ...template,
        source: 'url',
        id: template.id ?? url,
      };
      
      this.cache.set(url, template);
      return template;
    } catch (error) {
      throw new Error(`Failed to load template from URL: ${error}`);
    }
  }
  
  /**
   * Load template from an npm package
   */
  async fromNpm(packageName: string): Promise<Template> {
    const cached = this.cache.get(packageName);
    if (cached) {
      return cached;
    }
    
    try {
      // Try to resolve the package
      const packagePath = require.resolve(packageName, {
        paths: [process.cwd()],
      });
      
      // Read the package.json to find the template file
      const packageDir = path.dirname(packagePath);
      const packageJsonPath = path.join(packageDir, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      // Look for template file
      const templateFile = packageJson.template ?? packageJson.main ?? 'template.yaml';
      const templatePath = path.join(packageDir, templateFile);
      
      const template = await this.fromFile(templatePath);
      
      const result: Template = {
        ...template,
        source: 'npm',
        id: template.id ?? packageName,
      };
      
      this.cache.set(packageName, result);
      return result;
    } catch (error) {
      throw new Error(`Failed to load template from npm package "${packageName}": ${error}`);
    }
  }
  
  /**
   * Load template from a git repository
   */
  async fromGit(
    repository: string,
    options: { branch?: string; path?: string } = {}
  ): Promise<Template> {
    const cacheKey = `${repository}:${options.branch ?? 'main'}:${options.path ?? ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // This would require a git library like simple-git or isomorphic-git
    // For now, we'll throw an error suggesting to clone and load from file
    throw new Error(
      `Git template loading is not yet implemented. ` +
      `Please clone the repository and load the template from file: ${repository}`
    );
  }
  
  /**
   * Load all templates from a directory
   */
  async fromDirectory(dirPath: string): Promise<Template[]> {
    const absolutePath = path.resolve(dirPath);
    const templates: Template[] = [];
    
    try {
      const entries = await fs.readdir(absolutePath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Look for template file in subdirectory
          const subTemplates = await this.findTemplatesInDir(path.join(absolutePath, entry.name));
          templates.push(...subTemplates);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.yaml', '.yml', '.json', '.md', '.markdown'].includes(ext)) {
            try {
              const template = await this.fromFile(path.join(absolutePath, entry.name));
              templates.push(template);
            } catch {
              // Skip files that aren't valid templates
            }
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to load templates from directory "${dirPath}": ${error}`);
    }
    
    return templates;
  }
  
  /**
   * Clear the template cache
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Parse YAML template content
   */
  private async parseYaml(content: string): Promise<Template> {
    // Simple YAML parser for template format
    // In production, would use js-yaml library
    try {
      const data = this.parseSimpleYaml(content);
      return this.validateAndConvertTemplate(data);
    } catch (error) {
      throw new Error(`Failed to parse YAML template: ${error}`);
    }
  }
  
  /**
   * Parse JSON template content
   */
  private parseJson(content: string): Template {
    try {
      const data = JSON.parse(content);
      return this.validateAndConvertTemplate(data);
    } catch (error) {
      throw new Error(`Failed to parse JSON template: ${error}`);
    }
  }
  
  /**
   * Parse Markdown template content
   */
  private async parseMarkdown(content: string): Promise<Template> {
    // Extract frontmatter and content from markdown
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (!frontmatterMatch) {
      throw new Error('Markdown template must have YAML frontmatter');
    }
    
    const [, frontmatter, body] = frontmatterMatch;
    if (!frontmatter) {
      throw new Error('Markdown template must have YAML frontmatter');
    }
    
    const data = this.parseSimpleYaml(frontmatter);
    const template = this.validateAndConvertTemplate(data);
    
    // If no files defined, use the markdown body as the main content
    if (!template.files || template.files.length === 0) {
      const fileName = template.name ?? 'README.md';
      template.files = [{
        path: fileName.endsWith('.md') ? fileName : `${fileName}.md`,
        content: body ?? '',
      }];
    }
    
    return template;
  }
  
  /**
   * Validate and convert parsed data to Template
   */
  private validateAndConvertTemplate(data: Record<string, unknown>): Template {
    if (!data.name) {
      throw new Error('Template must have a "name" field');
    }
    
    if (!data.files) {
      throw new Error('Template must have a "files" field');
    }
    
    const template: Template = {
      name: String(data.name),
      version: String(data.version ?? '1.0.0'),
      files: this.parseFiles(data.files),
    };
    
    // Optional fields
    if (data.id) template.id = String(data.id);
    if (data.description) template.description = String(data.description);
    if (data.author) template.author = String(data.author);
    if (Array.isArray(data.tags)) template.tags = data.tags.map(String);
    if (data.variables) template.variables = this.parseVariables(data.variables);
    if (data.hooks) template.hooks = data.hooks as Template['hooks'];
    if (data.category) template.category = String(data.category);
    if (data.dependencies) template.dependencies = (data.dependencies as string[]).map(String);
    if (data.conflicts) template.conflicts = (data.conflicts as string[]).map(String);
    
    return template;
  }
  
  /**
   * Parse files array
   */
  private parseFiles(files: unknown): TemplateFile[] {
    if (!Array.isArray(files)) {
      throw new Error('"files" must be an array');
    }
    
    return files.map((file) => {
      if (typeof file === 'string') {
        return { path: file, content: '' };
      }
      
      if (typeof file !== 'object' || file === null) {
        throw new Error('Each file must be a string or object');
      }
      
      const f = file as Record<string, unknown>;
      
      const result: TemplateFile = {
        path: String(f.path ?? ''),
        content: typeof f.content === 'string' ? f.content : '',
      };
      
      if (f.condition) result.condition = String(f.condition);
      if (f.mode) result.mode = f.mode as TemplateFile['mode'];
      if (f.skipIfExists === true) result.skipIfExists = true;
      
      return result;
    });
  }
  
  /**
   * Parse variables array
   */
  private parseVariables(variables: unknown): TemplateVariable[] {
    if (!Array.isArray(variables)) {
      throw new Error('"variables" must be an array');
    }
    
    return variables.map((variable) => {
      if (typeof variable !== 'object' || variable === null) {
        throw new Error('Each variable must be an object');
      }
      
      const v = variable as Record<string, unknown>;
      
      return {
        name: String(v.name ?? ''),
        type: (v.type as TemplateVariable['type']) ?? 'string',
        description: v.description ? String(v.description) : undefined,
        default: v.default,
        required: v.required === true,
        validation: v.validation as TemplateVariable['validation'],
        options: Array.isArray(v.options) ? v.options.map((opt) => {
          if (typeof opt === 'object' && opt !== null) {
            const o = opt as Record<string, unknown>;
            return {
              label: String(o.label ?? ''),
              value: o.value,
            };
          }
          return { label: String(opt), value: opt };
        }) : undefined,
      };
    });
  }
  
  /**
   * Simple YAML parser for basic template format
   */
  private parseSimpleYaml(content: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = content.split('\n');
    let currentKey = '';
    let currentArray: unknown[] | null = null;
    let currentObject: Record<string, unknown> | null = null;
    let indent = 0;
    const stack: Array<{ obj: Record<string, unknown>; arr: unknown[] | null; indent: number }> = [];
    
    for (const line of lines) {
      // Skip empty lines and comments
      if (line.trim() === '' || line.trim().startsWith('#')) {
        continue;
      }
      
      // Calculate indentation
      const lineIndent = line.search(/\S/);
      const trimmed = line.trim();
      
      // Handle array items
      if (trimmed.startsWith('- ')) {
        const value = trimmed.slice(2);
        
        if (lineIndent < indent) {
          // Pop stack
          while (stack.length > 0 && stack[stack.length - 1]!.indent >= lineIndent) {
            stack.pop();
          }
          currentObject = stack[stack.length - 1]?.obj ?? result;
          currentArray = stack[stack.length - 1]?.arr ?? null;
        }
        
        if (currentArray === null) {
          currentArray = [];
          if (currentObject && currentKey) {
            currentObject[currentKey] = currentArray;
          }
          stack.push({ obj: currentObject ?? result, arr: currentArray, indent: lineIndent });
        }
        
        // Parse array item value
        if (value.includes(': ')) {
          // Object in array
          const obj: Record<string, unknown> = {};
          const [key, val] = value.split(': ');
          if (key) {
            obj[key.trim()] = this.parseValue(val ?? '');
          }
          currentArray.push(obj);
          currentObject = obj;
          currentArray = null;
          indent = lineIndent + 2;
          stack.push({ obj, arr: null, indent });
        } else {
          currentArray.push(this.parseValue(value));
        }
        continue;
      }
      
      // Handle key-value pairs
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();
      
      if (lineIndent < indent) {
        // Pop stack
        while (stack.length > 0 && stack[stack.length - 1]!.indent >= lineIndent) {
          stack.pop();
        }
        currentObject = stack[stack.length - 1]?.obj ?? result;
        currentArray = stack[stack.length - 1]?.arr ?? null;
        indent = stack[stack.length - 1]?.indent ?? 0;
      }
      
      if (!currentObject) {
        currentObject = result;
      }
      
      currentKey = key;
      
      if (value === '' || value === '|' || value === '>') {
        // Multi-line value or object/array start
        if (value === '|' || value === '>') {
          // Multi-line string - would need more parsing
          currentObject[key] = '';
        } else {
          // Could be object or array
          currentObject[key] = {};
          indent = lineIndent + 2;
          stack.push({ obj: currentObject[key] as Record<string, unknown>, arr: null, indent });
          currentObject = currentObject[key] as Record<string, unknown>;
          currentArray = null;
        }
      } else {
        currentObject[key] = this.parseValue(value);
      }
    }
    
    return result;
  }
  
  /**
   * Parse a YAML value
   */
  private parseValue(value: string): unknown {
    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    
    // Boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Null
    if (value.toLowerCase() === 'null' || value === '~') return null;
    
    // Number
    const num = Number(value);
    if (!isNaN(num)) return num;
    
    // Array
    if (value.startsWith('[') && value.endsWith(']')) {
      return value.slice(1, -1).split(',').map((s) => this.parseValue(s.trim()));
    }
    
    return value;
  }
  
  /**
   * Detect format from URL
   */
  private detectFormatFromUrl(url: string): 'yaml' | 'json' | 'markdown' {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    switch (ext) {
      case '.yaml':
      case '.yml':
        return 'yaml';
      case '.json':
        return 'json';
      case '.md':
      case '.markdown':
        return 'markdown';
      default:
        return 'yaml';
    }
  }
  
  /**
   * Find templates in a directory
   */
  private async findTemplatesInDir(dirPath: string): Promise<Template[]> {
    const templates: Template[] = [];
    
    const templateFiles = [
      'template.yaml',
      'template.yml',
      'template.json',
      'template.md',
    ];
    
    for (const fileName of templateFiles) {
      const filePath = path.join(dirPath, fileName);
      try {
        const template = await this.fromFile(filePath);
        templates.push(template);
        break; // Use first found template file
      } catch {
        // Try next file
      }
    }
    
    return templates;
  }
}

/**
 * Create a template loader instance
 */
export function createTemplateLoader(): ITemplateLoader {
  return new TemplateLoader();
}

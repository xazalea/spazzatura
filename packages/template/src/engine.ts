/**
 * Template engine implementation for Spazzatura
 * Supports {{variable}} syntax, conditionals, loops, and helpers
 */

import type {
  ITemplateEngine,
  TemplateContext,
  TemplateFormat,
  TemplateHelperFn,
} from './types.js';

/**
 * Change case helpers
 */
const changeCase = {
  upper: (str: string): string => str.toUpperCase(),
  lower: (str: string): string => str.toLowerCase(),
  
  camelCase: (str: string): string => {
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^(.)/, (c) => c.toLowerCase());
  },
  
  pascalCase: (str: string): string => {
    const camel = changeCase.camelCase(str);
    return camel.replace(/^(.)/, (c) => c.toUpperCase());
  },
  
  kebabCase: (str: string): string => {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  },
  
  snakeCase: (str: string): string => {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase();
  },
  
  capitalize: (str: string): string => {
    return str.replace(/^(.)/, (c) => c.toUpperCase());
  },
  
  trim: (str: string): string => str.trim(),
};

/**
 * Built-in template helpers
 */
const builtinHelpers: Record<string, TemplateHelperFn> = {
  // Case helpers
  upper: (value: unknown): string => changeCase.upper(String(value ?? '')),
  lower: (value: unknown): string => changeCase.lower(String(value ?? '')),
  camelCase: (value: unknown): string => changeCase.camelCase(String(value ?? '')),
  pascalCase: (value: unknown): string => changeCase.pascalCase(String(value ?? '')),
  kebabCase: (value: unknown): string => changeCase.kebabCase(String(value ?? '')),
  snakeCase: (value: unknown): string => changeCase.snakeCase(String(value ?? '')),
  capitalize: (value: unknown): string => changeCase.capitalize(String(value ?? '')),
  trim: (value: unknown): string => changeCase.trim(String(value ?? '')),
  
  // Default value helper
  default: (value: unknown, defaultValue: unknown): string => {
    return value !== undefined && value !== null && value !== '' 
      ? String(value) 
      : String(defaultValue ?? '');
  },
  
  // Comparison helpers
  eq: (a: unknown, b: unknown): string => (a === b ? 'true' : ''),
  ne: (a: unknown, b: unknown): string => (a !== b ? 'true' : ''),
  lt: (a: unknown, b: unknown): string => (Number(a) < Number(b) ? 'true' : ''),
  gt: (a: unknown, b: unknown): string => (Number(a) > Number(b) ? 'true' : ''),
  lte: (a: unknown, b: unknown): string => (Number(a) <= Number(b) ? 'true' : ''),
  gte: (a: unknown, b: unknown): string => (Number(a) >= Number(b) ? 'true' : ''),
  
  // Logical helpers
  and: (...args: unknown[]): string => {
    const values = args.slice(0, -1); // Last arg is options
    return values.every((v) => Boolean(v)) ? 'true' : '';
  },
  
  or: (...args: unknown[]): string => {
    const values = args.slice(0, -1); // Last arg is options
    return values.some((v) => Boolean(v)) ? 'true' : '';
  },
  
  not: (value: unknown): string => (!value ? 'true' : ''),
  
  // String helpers
  substring: (str: unknown, start: unknown, end?: unknown): string => {
    const s = String(str ?? '');
    const startIndex = Number(start) ?? 0;
    const endIndex = end !== undefined ? Number(end) : undefined;
    return endIndex !== undefined ? s.substring(startIndex, endIndex) : s.substring(startIndex);
  },
  
  replace: (str: unknown, search: unknown, replace: unknown): string => {
    return String(str ?? '').replace(new RegExp(String(search), 'g'), String(replace ?? ''));
  },
  
  split: (str: unknown, separator: unknown): string => {
    if (!Array.isArray(str)) {
      return String(str ?? '').split(String(separator ?? ',')).join(', ');
    }
    return String(str);
  },
  
  join: (arr: unknown, separator: unknown): string => {
    if (!Array.isArray(arr)) return '';
    return arr.join(String(separator ?? ','));
  },
  
  // Array helpers
  first: (arr: unknown): string => {
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return String(arr[0] ?? '');
  },
  
  last: (arr: unknown): string => {
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return String(arr[arr.length - 1] ?? '');
  },
  
  length: (value: unknown): string => {
    if (typeof value === 'string') return String(value.length);
    if (Array.isArray(value)) return String(value.length);
    if (typeof value === 'object' && value !== null) return String(Object.keys(value).length);
    return '0';
  },
  
  // Type helpers
  typeof: (value: unknown): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  },
  
  // JSON helper
  json: (value: unknown, indent?: unknown): string => {
    return JSON.stringify(value, null, indent ? Number(indent) : undefined) ?? '';
  },
  
  // Date helpers
  now: (): string => new Date().toISOString(),
  year: (): string => String(new Date().getFullYear()),
  
  // Math helpers
  add: (a: unknown, b: unknown): string => String(Number(a) + Number(b)),
  subtract: (a: unknown, b: unknown): string => String(Number(a) - Number(b)),
  multiply: (a: unknown, b: unknown): string => String(Number(a) * Number(b)),
  divide: (a: unknown, b: unknown): string => String(Number(a) / Number(b)),
  modulo: (a: unknown, b: unknown): string => String(Number(a) % Number(b)),
};

/**
 * Template engine implementation
 */
export class TemplateEngine implements ITemplateEngine {
  readonly format: TemplateFormat = 'builtin';
  
  private partials: Map<string, string> = new Map();
  private helpers: Map<string, TemplateHelperFn> = new Map();
  
  constructor() {
    // Register built-in helpers
    for (const [name, fn] of Object.entries(builtinHelpers)) {
      this.helpers.set(name, fn);
    }
  }
  
  /**
   * Compile a template string into a render function
   */
  compile(template: string): (context: TemplateContext) => string {
    const parsed = this.parse(template);
    return (context: TemplateContext) => this.renderParsed(parsed, context);
  }
  
  /**
   * Render a template with the given context
   */
  render(template: string, context: TemplateContext): string {
    const compiled = this.compile(template);
    return compiled(context);
  }
  
  /**
   * Register a partial template
   */
  registerPartial(name: string, content: string): void {
    this.partials.set(name, content);
  }
  
  /**
   * Register a helper function
   */
  registerHelper(name: string, fn: TemplateHelperFn): void {
    this.helpers.set(name, fn);
  }
  
  /**
   * Check if a template has conditional blocks
   */
  hasConditionals(template: string): boolean {
    return /\{\{#if\s/.test(template);
  }
  
  /**
   * Check if a template has loops
   */
  hasLoops(template: string): boolean {
    return /\{\{#each\s/.test(template);
  }
  
  /**
   * Parse template into tokens
   */
  private parse(template: string): Token[] {
    const tokens: Token[] = [];
    let remaining = template;
    let index = 0;
    
    while (remaining.length > 0) {
      // Check for comments
      if (remaining.startsWith('{{!--')) {
        const endIndex = remaining.indexOf('--}}');
        if (endIndex !== -1) {
          index += endIndex + 5;
          remaining = remaining.slice(endIndex + 5);
          continue;
        }
      }
      
      // Check for block opening
      const blockMatch = remaining.match(/^\{\{#(if|each|unless)\s+([^}]+)\}\}/);
      if (blockMatch) {
        const [full, type, expression] = blockMatch;
        tokens.push({
          type: 'block-start',
          blockType: type as 'if' | 'each' | 'unless',
          expression: expression?.trim() ?? '',
          index,
        });
        index += full.length;
        remaining = remaining.slice(full.length);
        continue;
      }
      
      // Check for else block
      if (remaining.startsWith('{{else}}')) {
        tokens.push({ type: 'else', index });
        index += 8;
        remaining = remaining.slice(8);
        continue;
      }
      
      // Check for block closing
      const closeMatch = remaining.match(/^\{\{\/(if|each|unless)\}\}/);
      if (closeMatch) {
        const [full, type] = closeMatch;
        tokens.push({
          type: 'block-end',
          blockType: type as 'if' | 'each' | 'unless',
          index,
        });
        index += full.length;
        remaining = remaining.slice(full.length);
        continue;
      }
      
      // Check for variable or helper
      const varMatch = remaining.match(/^\{\{([^#/][^}]*)\}\}/);
      if (varMatch) {
        const [full, expression] = varMatch;
        tokens.push({
          type: 'variable',
          expression: expression?.trim() ?? '',
          index,
        });
        index += full.length;
        remaining = remaining.slice(full.length);
        continue;
      }
      
      // Check for escaped variable
      if (remaining.startsWith('\\{{')) {
        tokens.push({ type: 'text', text: '{{', index });
        index += 3;
        remaining = remaining.slice(3);
        continue;
      }
      
      // Text content
      const nextTag = remaining.search(/\{\{|--}}/);
      if (nextTag === -1) {
        tokens.push({ type: 'text', text: remaining, index });
        break;
      } else if (nextTag > 0) {
        tokens.push({ type: 'text', text: remaining.slice(0, nextTag), index });
        index += nextTag;
        remaining = remaining.slice(nextTag);
      } else {
        // Unknown tag, treat as text
        const char = remaining.charAt(0);
        tokens.push({ type: 'text', text: char, index });
        index += 1;
        remaining = remaining.slice(1);
      }
    }
    
    return tokens;
  }
  
  /**
   * Render parsed tokens
   */
  private renderParsed(tokens: Token[], context: TemplateContext): string {
    let result = '';
    
    for (const token of tokens) {
      switch (token.type) {
        case 'text':
          result += token.text;
          break;
          
        case 'variable':
          result += this.evaluateExpression(token.expression, context);
          break;
          
        case 'block-start':
          const blockTokens = this.collectBlock(tokens, token);
          result += this.renderBlock(blockTokens, context);
          break;
          
        case 'else':
        case 'block-end':
          // These should be handled by collectBlock
          break;
      }
    }
    
    return result;
  }
  
  /**
   * Collect tokens for a block
   */
  private collectBlock(tokens: Token[], startToken: BlockStartToken): CollectedBlock {
    const blockType = startToken.blockType;
    const bodyTokens: Token[] = [];
    const elseTokens: Token[] = [];
    let inElse = false;
    let depth = 1;
    
    const startIndex = tokens.indexOf(startToken);
    
    for (let i = startIndex + 1; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token) continue;
      
      if (token.type === 'block-start' && token.blockType === blockType) {
        depth++;
      } else if (token.type === 'block-end' && token.blockType === blockType) {
        depth--;
        if (depth === 0) {
          return {
            startToken,
            bodyTokens,
            elseTokens,
            endIndex: i,
          };
        }
      } else if (token.type === 'else' && depth === 1) {
        inElse = true;
        continue;
      }
      
      if (inElse) {
        elseTokens.push(token);
      } else {
        bodyTokens.push(token);
      }
    }
    
    return {
      startToken,
      bodyTokens,
      elseTokens,
      endIndex: tokens.length - 1,
    };
  }
  
  /**
   * Render a block
   */
  private renderBlock(block: CollectedBlock, context: TemplateContext): string {
    const { startToken, bodyTokens, elseTokens } = block;
    
    switch (startToken.blockType) {
      case 'if':
        return this.renderIfBlock(startToken.expression, bodyTokens, elseTokens, context);
      case 'unless':
        return this.renderUnlessBlock(startToken.expression, bodyTokens, elseTokens, context);
      case 'each':
        return this.renderEachBlock(startToken.expression, bodyTokens, context);
      default:
        return '';
    }
  }
  
  /**
   * Render an if block
   */
  private renderIfBlock(
    expression: string,
    bodyTokens: Token[],
    elseTokens: Token[],
    context: TemplateContext
  ): string {
    const value = this.evaluateCondition(expression, context);
    if (value) {
      return this.renderParsed(bodyTokens, context);
    } else if (elseTokens.length > 0) {
      return this.renderParsed(elseTokens, context);
    }
    return '';
  }
  
  /**
   * Render an unless block
   */
  private renderUnlessBlock(
    expression: string,
    bodyTokens: Token[],
    elseTokens: Token[],
    context: TemplateContext
  ): string {
    const value = this.evaluateCondition(expression, context);
    if (!value) {
      return this.renderParsed(bodyTokens, context);
    } else if (elseTokens.length > 0) {
      return this.renderParsed(elseTokens, context);
    }
    return '';
  }
  
  /**
   * Render an each block
   */
  private renderEachBlock(
    expression: string,
    bodyTokens: Token[],
    context: TemplateContext
  ): string {
    // Parse expression: "items as |item, index|" or just "items"
    const match = expression.match(/^(\S+)(?:\s+as\s+\|([^|]+)\|)?$/);
    if (!match) return '';
    
    const arrayPath = match[1];
    if (!arrayPath) return '';
    
    const aliasStr = match[2];
    const aliases = aliasStr?.split(',').map((s) => s.trim()) ?? [];
    const [itemAlias, indexAlias] = aliases;
    
    const array = this.getValue(arrayPath, context);
    if (!Array.isArray(array)) return '';
    
    let result = '';
    for (let i = 0; i < array.length; i++) {
      const itemContext: TemplateContext = {
        ...context,
        variables: {
          ...context.variables,
          ...(itemAlias ? { [itemAlias]: array[i] } : {}),
          ...(indexAlias ? { [indexAlias]: i } : {}),
          '@index': i,
          '@first': i === 0,
          '@last': i === array.length - 1,
        },
      };
      result += this.renderParsed(bodyTokens, itemContext);
    }
    
    return result;
  }
  
  /**
   * Evaluate an expression
   */
  private evaluateExpression(expression: string, context: TemplateContext): string {
    // Check for helper call with arguments
    const helperMatch = expression.match(/^(\w+)\s+(.+)$/);
    if (helperMatch) {
      const helperName = helperMatch[1];
      const argsStr = helperMatch[2];
      
      if (!helperName || !argsStr) return '';
      
      const helper = this.helpers.get(helperName) ?? context.helpers?.[helperName];
      
      if (helper) {
        const args = this.parseArgs(argsStr, context);
        try {
          return String(helper(...args) ?? '');
        } catch {
          return '';
        }
      }
    }
    
    // Check for simple helper call (no arguments)
    if (this.helpers.has(expression) || context.helpers?.[expression]) {
      const helper = this.helpers.get(expression) ?? context.helpers?.[expression];
      try {
        return String(helper?.() ?? '');
      } catch {
        return '';
      }
    }
    
    // Get variable value
    const value = this.getValue(expression, context);
    return value !== undefined && value !== null ? String(value) : '';
  }
  
  /**
   * Evaluate a condition
   */
  private evaluateCondition(expression: string, context: TemplateContext): boolean {
    // Handle comparison operators
    const comparisonMatch = expression.match(/^(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/);
    if (comparisonMatch) {
      const [, left, op, right] = comparisonMatch;
      if (!left || !op || !right) return false;
      
      const leftVal = this.evaluateValue(left.trim(), context);
      const rightVal = this.evaluateValue(right.trim(), context);
      
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
    
    // Handle logical operators
    const andMatch = expression.match(/^(.+?)\s+&&\s+(.+)$/);
    if (andMatch) {
      const left = andMatch[1];
      const right = andMatch[2];
      if (!left || !right) return false;
      return this.evaluateCondition(left, context) && 
             this.evaluateCondition(right, context);
    }
    
    const orMatch = expression.match(/^(.+?)\s+\|\|\s+(.+)$/);
    if (orMatch) {
      const left = orMatch[1];
      const right = orMatch[2];
      if (!left || !right) return false;
      return this.evaluateCondition(left, context) || 
             this.evaluateCondition(right, context);
    }
    
    // Simple truthy check
    const value = this.evaluateValue(expression, context);
    return Boolean(value);
  }
  
  /**
   * Evaluate a value (literal or variable)
   */
  private evaluateValue(expression: string, context: TemplateContext): unknown {
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
    
    // Variable
    return this.getValue(expression, context);
  }
  
  /**
   * Get a value from context
   */
  private getValue(path: string, context: TemplateContext): unknown {
    const parts = path.split('.');
    let value: unknown = context.variables;
    
    for (const part of parts) {
      if (value === null || value === undefined) return undefined;
      
      // Handle array index access
      const indexMatch = part.match(/^\[(\d+)\]$/);
      if (indexMatch) {
        const index = Number(indexMatch[1]);
        value = (value as unknown[])[index];
      } else if (typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }
  
  /**
   * Parse arguments string
   */
  private parseArgs(argsStr: string, context: TemplateContext): unknown[] {
    const args: unknown[] = [];
    let current = '';
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];
      
      if (inString) {
        if (char === stringChar) {
          args.push(current);
          current = '';
          inString = false;
        } else {
          current += char;
        }
      } else if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
      } else if (char === ' ') {
        if (current) {
          args.push(this.evaluateValue(current, context));
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current) {
      args.push(this.evaluateValue(current, context));
    }
    
    return args;
  }
}

/**
 * Token types
 */
type Token = TextToken | VariableToken | BlockStartToken | BlockEndToken | ElseToken;

interface TextToken {
  type: 'text';
  text: string;
  index: number;
}

interface VariableToken {
  type: 'variable';
  expression: string;
  index: number;
}

interface BlockStartToken {
  type: 'block-start';
  blockType: 'if' | 'each' | 'unless';
  expression: string;
  index: number;
}

interface BlockEndToken {
  type: 'block-end';
  blockType: 'if' | 'each' | 'unless';
  index: number;
}

interface ElseToken {
  type: 'else';
  index: number;
}

interface CollectedBlock {
  startToken: BlockStartToken;
  bodyTokens: Token[];
  elseTokens: Token[];
  endIndex: number;
}

/**
 * Create a default template engine
 */
export function createTemplateEngine(): ITemplateEngine {
  return new TemplateEngine();
}

/**
 * Helper functions for string transformation
 */
export const helpers = changeCase;

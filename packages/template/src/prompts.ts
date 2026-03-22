/**
 * Interactive prompts for template variables
 * Provides user-friendly prompts for collecting variable values
 */

import type {
  Template,
  TemplateVariable,
  PromptOptions,
  PromptResult,
  SelectOption,
} from './types.js';

/**
 * Prompt adapter interface for different environments
 */
export interface IPromptAdapter {
  string(message: string, defaultValue?: string): Promise<string>;
  number(message: string, defaultValue?: number): Promise<number>;
  boolean(message: string, defaultValue?: boolean): Promise<boolean>;
  select(message: string, options: SelectOption[], defaultValue?: string | number | boolean): Promise<string | number | boolean>;
  multiselect(message: string, options: SelectOption[], defaultValues?: (string | number | boolean)[]): Promise<(string | number | boolean)[]>;
}

/**
 * Console prompt adapter for terminal-based prompts
 */
export class ConsolePromptAdapter implements IPromptAdapter {
  private readline: typeof import('readline') | null = null;
  
  private async getReadline(): Promise<typeof import('readline')>{
    if (!this.readline) {
      this.readline = await import('readline');
    }
    return this.readline;
  }
  
  async string(message: string, defaultValue?: string): Promise<string> {
    const rl = await this.getReadline();
    return new Promise((resolve) => {
      const prompt = defaultValue 
        ? `${message} [${defaultValue}]: `
        : `${message}: `;
      
      const interface_ = rl.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      
      interface_.question(prompt, (answer) => {
        interface_.close();
        resolve(answer.trim() || defaultValue || '');
      });
    });
  }
  
  async number(message: string, defaultValue?: number): Promise<number> {
    const rl = await this.getReadline();
    return new Promise((resolve) => {
      const prompt = defaultValue !== undefined
        ? `${message} [${defaultValue}]: `
        : `${message}: `;
      
      const interface_ = rl.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      
      interface_.question(prompt, (answer) => {
        interface_.close();
        const num = parseFloat(answer.trim());
        if (isNaN(num)) {
          resolve(defaultValue ?? 0);
        } else {
          resolve(num);
        }
      });
    });
  }
  
  async boolean(message: string, defaultValue?: boolean): Promise<boolean> {
    const rl = await this.getReadline();
    return new Promise((resolve) => {
      const hint = defaultValue === true ? 'Y/n' : defaultValue === false ? 'y/N' : 'y/n';
      const prompt = `${message} [${hint}]: `;
      
      const interface_ = rl.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      
      interface_.question(prompt, (answer: string) => {
        interface_.close();
        const trimmed = answer.trim().toLowerCase();
        if (trimmed === '' && defaultValue !== undefined) {
          resolve(defaultValue);
        } else {
          resolve(trimmed === 'y' || trimmed === 'yes' || trimmed === 'true');
        }
      });
    });
  }
  
  async select(
    message: string,
    options: SelectOption[],
    defaultValue?: string | number | boolean
  ): Promise<string | number | boolean> {
    const rl = await this.getReadline();
    return new Promise((resolve) => {
      console.log(`${message}:`);
      options.forEach((option, index) => {
        const marker = option.value === defaultValue ? '*' : ' ';
        console.log(`  ${marker} ${index + 1}. ${option.label}`);
      });
      
      const interface_ = rl.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      
      interface_.question('Enter choice: ', (answer) => {
        interface_.close();
        const index = parseInt(answer.trim(), 10) - 1;
        if (index >= 0 && index < options.length) {
          resolve(options[index]!.value);
        } else if (defaultValue !== undefined) {
          resolve(defaultValue);
        } else {
          resolve(options[0]!.value);
        }
      });
    });
  }
  
  async multiselect(
    message: string,
    options: SelectOption[],
    defaultValues?: (string | number | boolean)[]
  ): Promise<(string | number | boolean)[]> {
    const rl = await this.getReadline();
    return new Promise((resolve) => {
      console.log(`${message} (comma-separated numbers):`);
      options.forEach((option, index) => {
        const marker = defaultValues?.includes(option.value) ? '*' : ' ';
        console.log(`  ${marker} ${index + 1}. ${option.label}`);
      });
      
      const interface_ = rl.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      
      interface_.question('Enter choices: ', (answer) => {
        interface_.close();
        const indices = answer.split(',').map((s) => parseInt(s.trim(), 10) - 1);
        const values: (string | number | boolean)[] = [];
        
        for (const index of indices) {
          if (index >= 0 && index < options.length) {
            values.push(options[index]!.value);
          }
        }
        
        if (values.length === 0 && defaultValues) {
          resolve(defaultValues);
        } else {
          resolve(values);
        }
      });
    });
  }
}

/**
 * Prompt manager for collecting template variable values
 */
export class PromptManager {
  private adapter: IPromptAdapter;
  
  constructor(adapter?: IPromptAdapter) {
    this.adapter = adapter ?? new ConsolePromptAdapter();
  }
  
  /**
   * Prompt for all template variables
   */
  async promptForVariables(
    template: Template,
    options: PromptOptions = {}
  ): Promise<PromptResult> {
    const variables: Record<string, unknown> = {};
    const skipped: string[] = [];
    
    if (!template.variables || template.variables.length === 0) {
      return {
        variables,
        interactive: !options.nonInteractive,
        skipped,
      };
    }
    
    // Group variables by group
    const groups = this.groupVariables(template.variables);
    
    // Prompt for each variable
    for (const [group, vars] of groups) {
      if (group) {
        console.log(`\n${group}:`);
      }
      
      for (const variable of vars) {
        // Skip if in skip list
        if (options.skip?.includes(variable.name)) {
          skipped.push(variable.name);
          continue;
        }
        
        // Use default value if provided
        if (options.defaults?.[variable.name] !== undefined) {
          variables[variable.name] = options.defaults[variable.name];
          continue;
        }
        
        // Skip in non-interactive mode
        if (options.nonInteractive) {
          if (variable.default !== undefined) {
            variables[variable.name] = variable.default;
          } else if (variable.required) {
            throw new Error(`Required variable "${variable.name}" has no default value`);
          }
          continue;
        }
        
        // Prompt for value
        try {
          const value = await this.promptForVariable(variable);
          variables[variable.name] = value;
        } catch (error) {
          if (variable.required) {
            throw error;
          }
          // Use default for optional variables on error
          if (variable.default !== undefined) {
            variables[variable.name] = variable.default;
          }
        }
      }
    }
    
    return {
      variables,
      interactive: !options.nonInteractive,
      skipped,
    };
  }
  
  /**
   * Prompt for a single variable
   */
  async promptForVariable(variable: TemplateVariable): Promise<unknown> {
    const message = this.formatMessage(variable);
    
    let value: unknown;
    
    switch (variable.type) {
      case 'string':
        value = await this.adapter.string(message, variable.default as string | undefined);
        break;
        
      case 'number':
        value = await this.adapter.number(message, variable.default as number | undefined);
        break;
        
      case 'boolean':
        value = await this.adapter.boolean(message, variable.default as boolean | undefined);
        break;
        
      case 'select':
        if (!variable.options || variable.options.length === 0) {
          throw new Error(`Variable "${variable.name}" of type "select" has no options`);
        }
        value = await this.adapter.select(message, variable.options, variable.default as string | number | boolean | undefined);
        break;
        
      case 'multiselect':
        if (!variable.options || variable.options.length === 0) {
          throw new Error(`Variable "${variable.name}" of type "multiselect" has no options`);
        }
        value = await this.adapter.multiselect(
          message,
          variable.options,
          variable.default as (string | number | boolean)[] | undefined
        );
        break;
        
      default:
        throw new Error(`Unknown variable type: ${variable.type}`);
    }
    
    // Validate the value
    if (variable.required && (value === undefined || value === null || value === '')) {
      throw new Error(`Variable "${variable.name}" is required`);
    }
    
    // Apply validation rules
    if (variable.validation && value !== undefined && value !== null && value !== '') {
      this.validateValue(variable, value);
    }
    
    return value;
  }
  
  /**
   * Format prompt message for a variable
   */
  private formatMessage(variable: TemplateVariable): string {
    let message = variable.description ?? variable.name;
    
    if (variable.required) {
      message += ' (required)';
    }
    
    return message;
  }
  
  /**
   * Group variables by their group property
   */
  private groupVariables(variables: TemplateVariable[]): Map<string | undefined, TemplateVariable[]> {
    const groups = new Map<string | undefined, TemplateVariable[]>();
    
    for (const variable of variables) {
      const group = variable.group;
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(variable);
    }
    
    return groups;
  }
  
  /**
   * Validate a value against validation rules
   */
  private validateValue(variable: TemplateVariable, value: unknown): void {
    const { validation } = variable;
    if (!validation) return;
    
    // Pattern validation
    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        throw new Error(
          validation.message ?? 
          `Value does not match pattern: ${validation.pattern}`
        );
      }
    }
    
    // Min/max for numbers
    if (typeof value === 'number') {
      if (validation.min !== undefined && value < validation.min) {
        throw new Error(`Value must be at least ${validation.min}`);
      }
      if (validation.max !== undefined && value > validation.max) {
        throw new Error(`Value must be at most ${validation.max}`);
      }
    }
    
    // Min/max length for strings
    if (typeof value === 'string') {
      if (validation.min !== undefined && value.length < validation.min) {
        throw new Error(`String must be at least ${validation.min} characters`);
      }
      if (validation.max !== undefined && value.length > validation.max) {
        throw new Error(`String must be at most ${validation.max} characters`);
      }
    }
  }
}

/**
 * Create a prompt manager instance
 */
export function createPromptManager(adapter?: IPromptAdapter): PromptManager {
  return new PromptManager(adapter);
}

/**
 * Quick prompt function for simple use cases
 */
export async function promptForVariables(
  template: Template,
  options?: PromptOptions
): Promise<PromptResult> {
  const manager = new PromptManager();
  return manager.promptForVariables(template, options);
}

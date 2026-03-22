/**
 * Input handling utilities
 * User input processing for CLI
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { output } from './output.js';

/**
 * Prompt for text input
 */
export async function promptText(
  message: string,
  defaultValue?: string,
  validate?: (input: string) => boolean | string
): Promise<string> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'value',
      message,
      default: defaultValue,
      validate: validate || ((input: string) => input.length > 0 || 'Input is required'),
    },
  ]);
  
  return answers.value;
}

/**
 * Prompt for password/secret input
 */
export async function promptPassword(
  message: string = 'Enter password'
): Promise<string> {
  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'value',
      message,
      mask: '*',
    },
  ]);
  
  return answers.value;
}

/**
 * Prompt for confirmation
 */
export async function promptConfirm(
  message: string,
  defaultValue: boolean = false
): Promise<boolean> {
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'value',
      message,
      default: defaultValue,
    },
  ]);
  
  return answers.value;
}

/**
 * Prompt for selection from list
 */
export async function promptSelect<T extends string>(
  message: string,
  choices: T[] | { name: string; value: T }[],
  defaultValue?: T
): Promise<T> {
  const formattedChoices = typeof choices[0] === 'string'
    ? (choices as string[]).map(c => ({ name: c, value: c }))
    : choices;
  
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'value',
      message,
      choices: formattedChoices,
      default: defaultValue,
    },
  ]);
  
  return answers.value;
}

/**
 * Prompt for multiple selections
 */
export async function promptMultiSelect<T extends string>(
  message: string,
  choices: T[] | { name: string; value: T }[],
  defaultValues?: T[]
): Promise<T[]> {
  const formattedChoices = typeof choices[0] === 'string'
    ? (choices as string[]).map(c => ({ name: c, value: c }))
    : choices;
  
  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'value',
      message,
      choices: formattedChoices,
      default: defaultValues,
    },
  ]);
  
  return answers.value;
}

/**
 * Prompt for editor input
 */
export async function promptEditor(
  message: string,
  defaultValue?: string
): Promise<string> {
  const answers = await inquirer.prompt([
    {
      type: 'editor',
      name: 'value',
      message,
      default: defaultValue,
    },
  ]);
  
  return answers.value;
}

/**
 * Prompt for number input
 */
export async function promptNumber(
  message: string,
  defaultValue?: number,
  min?: number,
  max?: number
): Promise<number> {
  const answers = await inquirer.prompt([
    {
      type: 'number',
      name: 'value',
      message,
      default: defaultValue,
      validate: (input: number) => {
        if (isNaN(input)) return 'Please enter a valid number';
        if (min !== undefined && input < min) return `Minimum value is ${min}`;
        if (max !== undefined && input > max) return `Maximum value is ${max}`;
        return true;
      },
    },
  ]);
  
  return answers.value;
}

/**
 * Prompt for file path with auto-completion
 */
export async function promptFilePath(
  message: string,
  basePath: string = '.',
  defaultValue?: string
): Promise<string> {
  // TODO: Add file path auto-completion
  return promptText(message, defaultValue);
}

/**
 * Prompt for multi-line text
 */
export async function promptMultiline(
  message: string,
  defaultValue?: string
): Promise<string> {
  output.info(chalk.dim(`${message} (Press Ctrl+D when done)`));
  
  const lines: string[] = [];
  const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.on('line', (line: string) => {
      lines.push(line);
    });
    
    rl.on('close', () => {
      resolve(lines.join('\n'));
    });
  });
}

/**
 * Prompt with auto-suggestions
 */
export async function promptWithSuggestions(
  message: string,
  suggestions: string[],
  defaultValue?: string
): Promise<string> {
  // Use autocomplete prompt from inquirer
  const answers = await inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'value',
      message,
      source: async (_answers: unknown, input: string = '') => {
        return suggestions.filter(s => 
          s.toLowerCase().includes(input.toLowerCase())
        );
      },
    },
  ]);
  
  return answers.value;
}

/**
 * Wait for user to press any key
 */
export async function pressAnyKey(message: string = 'Press any key to continue...'): Promise<void> {
  output.info(chalk.dim(message));
  
  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      resolve();
    });
  });
}

/**
 * Prompt for Y/N confirmation (quick)
 */
export async function quickConfirm(message: string): Promise<boolean> {
  output.info(`${message} ${chalk.dim('[y/N]')}`);
  
  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', (data: Buffer) => {
      process.stdin.setRawMode(false);
      const answer = data.toString().toLowerCase().trim();
      resolve(answer === 'y' || answer === 'yes');
    });
  });
}

/**
 * Input validator functions
 */
export const validators = {
  required: (input: string): boolean | string => 
    input.length > 0 || 'This field is required',
  
  email: (input: string): boolean | string => 
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) || 'Please enter a valid email',
  
  url: (input: string): boolean | string => {
    try {
      new URL(input);
      return true;
    } catch {
      return 'Please enter a valid URL';
    }
  },
  
  number: (input: string): boolean | string => 
    !isNaN(Number(input)) || 'Please enter a valid number',
  
  minLength: (min: number) => (input: string): boolean | string =>
    input.length >= min || `Minimum ${min} characters required`,
  
  maxLength: (max: number) => (input: string): boolean | string =>
    input.length <= max || `Maximum ${max} characters allowed`,
  
  pattern: (regex: RegExp, message: string) => (input: string): boolean | string =>
    regex.test(input) || message,
  
  oneOf: <T>(values: T[]) => (input: string): boolean | string =>
    values.includes(input as T) || `Must be one of: ${values.join(', ')}`,
};

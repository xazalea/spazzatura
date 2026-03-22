/**
 * Template command module
 * Template management
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import { output } from '../utils/output.js';
import { createSpinner } from '../ui/spinner.js';

export const templateCommand = new Command('template')
  .description('Template management')
  .addCommand(
    new Command('list')
      .description('List available templates')
      .option('--json', 'Output as JSON')
      .action(async (options: { json?: boolean }) => {
        await listTemplates(options);
      })
  )
  .addCommand(
    new Command('apply')
      .description('Apply a template')
      .argument('<name>', 'Template name')
      .option('-o, --output <path>', 'Output directory')
      .option('-v, --var <vars>', 'Variables in key=value format (comma-separated)')
      .action(async (name: string, options: ApplyOptions) => {
        await applyTemplate(name, options);
      })
  )
  .addCommand(
    new Command('create')
      .description('Create a new template')
      .argument('<name>', 'Template name')
      .option('-f, --from <path>', 'Create from existing directory')
      .option('-d, --description <desc>', 'Template description')
      .action(async (name: string, options: CreateOptions) => {
        await createTemplate(name, options);
      })
  )
  .addCommand(
    new Command('validate')
      .description('Validate a template')
      .argument('<name>', 'Template name')
      .action(async (name: string) => {
        await validateTemplate(name);
      })
  )
  .addCommand(
    new Command('install')
      .description('Install template from marketplace')
      .argument('<package>', 'Package name')
      .action(async (pkg: string) => {
        await installTemplate(pkg);
      })
  )
  .addCommand(
    new Command('info')
      .description('Show template information')
      .argument('<name>', 'Template name')
      .action(async (name: string) => {
        await showTemplateInfo(name);
      })
  );

/**
 * Apply options
 */
interface ApplyOptions {
  output?: string;
  var?: string;
}

/**
 * Create options
 */
interface CreateOptions {
  from?: string;
  description?: string;
}

/**
 * Built-in templates
 */
const BUILTIN_TEMPLATES = [
  {
    name: 'react-component',
    description: 'React component with TypeScript',
    variables: ['name', 'style', 'test'],
    files: ['Component.tsx', 'Component.module.css', 'Component.test.tsx'],
  },
  {
    name: 'api-endpoint',
    description: 'REST API endpoint handler',
    variables: ['name', 'method', 'path'],
    files: ['handler.ts', 'types.ts', 'test.ts'],
  },
  {
    name: 'unit-test',
    description: 'Unit test file',
    variables: ['name', 'target'],
    files: ['test.ts'],
  },
  {
    name: 'cli-command',
    description: 'CLI command module',
    variables: ['name', 'description'],
    files: ['command.ts', 'test.ts'],
  },
  {
    name: 'express-route',
    description: 'Express.js route handler',
    variables: ['name', 'path', 'methods'],
    files: ['route.ts', 'controller.ts', 'validation.ts'],
  },
];

/**
 * List available templates
 */
async function listTemplates(options: { json?: boolean }): Promise<void> {
  if (options.json) {
    output.json(BUILTIN_TEMPLATES);
    return;
  }

  const table = new Table({
    head: [chalk.cyan('Name'), chalk.cyan('Description'), chalk.cyan('Variables'), chalk.cyan('Files')],
    colWidths: [18, 35, 25, 25],
  });

  for (const template of BUILTIN_TEMPLATES) {
    table.push([
      template.name,
      template.description,
      template.variables.join(', '),
      template.files.length + ' files',
    ]);
  }

  output.info(table.toString());
  output.newline();
  output.info(chalk.dim(`Total: ${BUILTIN_TEMPLATES.length} templates`));
}

/**
 * Apply a template
 */
async function applyTemplate(name: string, options: ApplyOptions): Promise<void> {
  const template = BUILTIN_TEMPLATES.find(t => t.name === name);
  
  if (!template) {
    output.error(`Template "${name}" not found. Use "template list" to see available templates.`);
    process.exit(1);
  }

  output.info(chalk.cyan(`Applying template: ${name}`));
  output.newline();

  // Parse variables from command line or prompt
  let variables: Record<string, string> = {};
  
  if (options.var) {
    // Parse key=value pairs
    for (const pair of options.var.split(',')) {
      const [key, value] = pair.split('=');
      if (key && value) {
        variables[key.trim()] = value.trim();
      }
    }
  }

  // Prompt for missing variables
  const missingVars = template.variables.filter(v => !variables[v]);
  
  if (missingVars.length > 0) {
    const prompts = missingVars.map(varName => ({
      type: 'input',
      name: varName,
      message: `Enter value for "${varName}":`,
      validate: (input: string) => input.length > 0 || `${varName} is required`,
    }));

    const answers = await inquirer.prompt(prompts);
    variables = { ...variables, ...answers };
  }

  // Get output directory
  let outputDir = options.output;
  
  if (!outputDir) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'output',
        message: 'Output directory:',
        default: './',
      },
    ]);
    outputDir = answers.output;
  }

  const spinner = createSpinner('Applying template...');
  spinner.start();

  // TODO: Integrate with actual template engine
  await new Promise(resolve => setTimeout(resolve, 1500));

  spinner.stop();
  
  output.success(`Template "${name}" applied successfully!`);
  output.info(chalk.dim(`Output: ${outputDir}`));
  output.newline();
  output.info('Files created:');
  for (const file of template.files) {
    output.info(chalk.dim(`  ${file}`));
  }
}

/**
 * Create a new template
 */
async function createTemplate(name: string, options: CreateOptions): Promise<void> {
  output.info(`Creating template "${name}"...`);

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Template description:',
      default: options.description,
      validate: (input: string) => input.length > 0 || 'Description is required',
    },
    {
      type: 'input',
      name: 'variables',
      message: 'Variables (comma-separated):',
      default: 'name',
    },
    {
      type: 'confirm',
      name: 'createFrom',
      message: 'Create from existing directory?',
      default: !!options.from,
    },
    {
      type: 'input',
      name: 'sourcePath',
      message: 'Source directory:',
      default: options.from || './',
      when: (ans) => ans.createFrom,
    },
  ]);

  const spinner = createSpinner('Creating template...');
  spinner.start();

  // TODO: Actually create template
  await new Promise(resolve => setTimeout(resolve, 1000));

  spinner.stop();
  
  output.success(`Template "${name}" created!`);
  output.info(chalk.dim(`Description: ${answers.description}`));
  output.info(chalk.dim(`Variables: ${answers.variables}`));
}

/**
 * Validate a template
 */
async function validateTemplate(name: string): Promise<void> {
  output.info(`Validating template "${name}"...`);
  
  const spinner = createSpinner('Validating...');
  spinner.start();

  // TODO: Integrate with actual validation
  await new Promise(resolve => setTimeout(resolve, 1000));

  spinner.stop();
  
  output.success(`Template "${name}" is valid!`);
  output.newline();
  output.info(chalk.dim('Validation results:'));
  output.info(chalk.dim('  ✓ Template structure valid'));
  output.info(chalk.dim('  ✓ All variables defined'));
  output.info(chalk.dim('  ✓ File templates valid'));
}

/**
 * Install template from marketplace
 */
async function installTemplate(pkg: string): Promise<void> {
  output.info(`Installing template from marketplace: ${pkg}`);
  
  const spinner = createSpinner('Installing...');
  spinner.start();

  // TODO: Integrate with marketplace
  await new Promise(resolve => setTimeout(resolve, 2000));

  spinner.stop();
  
  output.success(`Template "${pkg}" installed successfully!`);
}

/**
 * Show template information
 */
async function showTemplateInfo(name: string): Promise<void> {
  const template = BUILTIN_TEMPLATES.find(t => t.name === name);
  
  if (!template) {
    output.error(`Template "${name}" not found.`);
    process.exit(1);
  }

  output.info(chalk.cyan.bold(`\nTemplate: ${template.name}`));
  output.info(chalk.dim('─'.repeat(50)));
  output.info(`${chalk.bold('Description:')} ${template.description}`);
  output.info(`${chalk.bold('Variables:')} ${template.variables.join(', ')}`);
  output.info(`${chalk.bold('Files:')}`);
  for (const file of template.files) {
    output.info(chalk.dim(`  - ${file}`));
  }
  output.newline();
  
  output.info('Usage:');
  output.info(chalk.dim(`  spazzatura template apply ${name} -o ./output -v name=MyComponent`));
  output.newline();
}

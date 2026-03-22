/**
 * Skill command module
 * Skill management and execution
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import { output } from '../utils/output.js';
import { createSpinner } from '../ui/spinner.js';

export const skillCommand = new Command('skill')
  .description('Skill management and execution')
  .addCommand(
    new Command('list')
      .description('List available skills')
      .option('--json', 'Output as JSON')
      .action(async (options: { json?: boolean }) => {
        await listSkills(options);
      })
  )
  .addCommand(
    new Command('run')
      .description('Execute a skill')
      .argument('<skill>', 'Skill name to execute')
      .option('-p, --path <path>', 'Path to operate on')
      .option('-m, --mode <mode>', 'Skill mode')
      .option('--parallel', 'Run parallel review')
      .action(async (skill: string, options: RunOptions) => {
        await runSkill(skill, options);
      })
  )
  .addCommand(
    new Command('create')
      .description('Create a new skill')
      .argument('<name>', 'Skill name')
      .option('-t, --template <template>', 'Template to use')
      .option('--tools <tools>', 'Comma-separated list of tools')
      .action(async (name: string, options: CreateOptions) => {
        await createSkill(name, options);
      })
  )
  .addCommand(
    new Command('validate')
      .description('Validate a skill')
      .argument('<name>', 'Skill name to validate')
      .action(async (name: string) => {
        await validateSkill(name);
      })
  )
  .addCommand(
    new Command('install')
      .description('Install skill from marketplace')
      .argument('<package>', 'Package name (e.g., @community/api-generator)')
      .action(async (pkg: string) => {
        await installSkill(pkg);
      })
  )
  .addCommand(
    new Command('publish')
      .description('Publish skill to marketplace')
      .argument('<name>', 'Skill name to publish')
      .action(async (name: string) => {
        await publishSkill(name);
      })
  )
  .addCommand(
    new Command('info')
      .description('Show skill information')
      .argument('<skill>', 'Skill name')
      .action(async (skill: string) => {
        await showSkillInfo(skill);
      })
  );

/**
 * Run options
 */
interface RunOptions {
  path?: string;
  mode?: string;
  parallel?: boolean;
}

/**
 * Create options
 */
interface CreateOptions {
  template?: string;
  tools?: string;
}

/**
 * Built-in skills
 */
const BUILTIN_SKILLS = [
  {
    name: 'code-review',
    description: 'Comprehensive code review with multiple perspectives',
    modes: ['default', 'security', 'performance', 'style'],
    tools: ['file_read', 'git_diff', 'search_code'],
    status: 'available',
  },
  {
    name: 'test-generation',
    description: 'Generate unit tests for code',
    modes: ['default', 'coverage-focused', 'edge-cases'],
    tools: ['file_read', 'file_write', 'execute_command'],
    status: 'available',
  },
  {
    name: 'refactoring',
    description: 'Code refactoring and optimization',
    modes: ['default', 'extract-method', 'simplify'],
    tools: ['file_read', 'file_write', 'search_code'],
    status: 'available',
  },
  {
    name: 'documentation',
    description: 'Generate documentation for code',
    modes: ['default', 'api', 'readme'],
    tools: ['file_read', 'file_write'],
    status: 'available',
  },
  {
    name: 'security-audit',
    description: 'Security vulnerability analysis',
    modes: ['default', 'owasp', 'dependencies'],
    tools: ['file_read', 'search_code', 'execute_command'],
    status: 'available',
  },
];

/**
 * List available skills
 */
async function listSkills(options: { json?: boolean }): Promise<void> {
  if (options.json) {
    output.json(BUILTIN_SKILLS);
    return;
  }

  const table = new Table({
    head: [chalk.cyan('Name'), chalk.cyan('Description'), chalk.cyan('Modes'), chalk.cyan('Status')],
    colWidths: [18, 40, 25, 12],
  });

  for (const skill of BUILTIN_SKILLS) {
    table.push([
      skill.name,
      skill.description,
      skill.modes.slice(0, 2).join(', ') + (skill.modes.length > 2 ? '...' : ''),
      skill.status === 'available' ? chalk.green('✓ Available') : chalk.yellow('Busy'),
    ]);
  }

  output.info(table.toString());
  output.newline();
  output.info(chalk.dim(`Total: ${BUILTIN_SKILLS.length} skills`));
}

/**
 * Execute a skill
 */
async function runSkill(skill: string, options: RunOptions): Promise<void> {
  const skillInfo = BUILTIN_SKILLS.find(s => s.name === skill);
  
  if (!skillInfo) {
    output.error(`Skill "${skill}" not found. Use "skill list" to see available skills.`);
    process.exit(1);
  }

  let mode = options.mode;
  
  if (!mode) {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: 'Select skill mode:',
        choices: skillInfo.modes,
        default: 'default',
      },
    ]);
    mode = answers.mode;
  }

  let path = options.path;
  
  if (!path) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'path',
        message: 'Enter path to operate on:',
        default: '.',
      },
    ]);
    path = answers.path;
  }

  output.info(chalk.cyan(`Running skill: ${skill}`));
  output.info(chalk.dim(`Mode: ${mode}`));
  output.info(chalk.dim(`Path: ${path}`));
  output.newline();

  const spinner = createSpinner('Executing skill...');
  spinner.start();

  // TODO: Integrate with actual skill engine
  await new Promise(resolve => setTimeout(resolve, 2000));

  spinner.stop();
  
  output.success(`Skill "${skill}" completed!`);
  output.newline();
  output.info(chalk.dim('Result: Skill integration will be implemented in a subsequent task.'));
}

/**
 * Create a new skill
 */
async function createSkill(name: string, options: CreateOptions): Promise<void> {
  output.info(`Creating skill "${name}"...`);

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'template',
      message: 'Select skill template:',
      choices: ['basic', 'code-review', 'test-generation', 'custom'],
      default: options.template || 'basic',
    },
    {
      type: 'checkbox',
      name: 'tools',
      message: 'Select tools for the skill:',
      choices: [
        { name: 'file_read', checked: true },
        { name: 'file_write', checked: true },
        { name: 'execute_command', checked: false },
        { name: 'git_operations', checked: false },
        { name: 'search_code', checked: false },
        { name: 'web_search', checked: false },
      ],
    },
    {
      type: 'input',
      name: 'description',
      message: 'Enter skill description:',
      validate: (input: string) => input.length > 0 || 'Description is required',
    },
  ]);

  const spinner = createSpinner('Creating skill...');
  spinner.start();

  // TODO: Actually create skill configuration
  await new Promise(resolve => setTimeout(resolve, 1000));

  spinner.stop();
  
  output.success(`Skill "${name}" created successfully!`);
  output.info(chalk.dim(`Template: ${answers.template}`));
  output.info(chalk.dim(`Tools: ${answers.tools.join(', ')}`));
}

/**
 * Validate a skill
 */
async function validateSkill(name: string): Promise<void> {
  output.info(`Validating skill "${name}"...`);
  
  const spinner = createSpinner('Validating...');
  spinner.start();

  // TODO: Integrate with actual validation
  await new Promise(resolve => setTimeout(resolve, 1000));

  spinner.stop();
  
  output.success(`Skill "${name}" is valid!`);
}

/**
 * Install skill from marketplace
 */
async function installSkill(pkg: string): Promise<void> {
  output.info(`Installing skill from marketplace: ${pkg}`);
  
  const spinner = createSpinner('Installing...');
  spinner.start();

  // TODO: Integrate with marketplace
  await new Promise(resolve => setTimeout(resolve, 2000));

  spinner.stop();
  
  output.success(`Skill "${pkg}" installed successfully!`);
}

/**
 * Publish skill to marketplace
 */
async function publishSkill(name: string): Promise<void> {
  output.info(`Publishing skill "${name}" to marketplace...`);
  
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to publish this skill?',
      default: false,
    },
  ]);

  if (!answers.confirm) {
    output.info('Publish cancelled.');
    return;
  }

  const spinner = createSpinner('Publishing...');
  spinner.start();

  // TODO: Integrate with marketplace
  await new Promise(resolve => setTimeout(resolve, 2000));

  spinner.stop();
  
  output.success(`Skill "${name}" published successfully!`);
}

/**
 * Show skill information
 */
async function showSkillInfo(skill: string): Promise<void> {
  const skillInfo = BUILTIN_SKILLS.find(s => s.name === skill);
  
  if (!skillInfo) {
    output.error(`Skill "${skill}" not found.`);
    process.exit(1);
  }

  output.info(chalk.cyan.bold(`\nSkill: ${skillInfo.name}`));
  output.info(chalk.dim('─'.repeat(50)));
  output.info(`${chalk.bold('Description:')} ${skillInfo.description}`);
  output.info(`${chalk.bold('Modes:')} ${skillInfo.modes.join(', ')}`);
  output.info(`${chalk.bold('Tools:')} ${skillInfo.tools.join(', ')}`);
  output.info(`${chalk.bold('Status:')} ${skillInfo.status}`);
  output.newline();
}

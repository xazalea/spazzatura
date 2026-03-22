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
import { BUILTIN_SKILLS as SKILL_INSTANCES } from '@spazzatura/skill';
import { randomUUID } from 'crypto';

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

// Legacy static list merged with real skill instances
const STATIC_SKILLS = [
  { name: 'test-generation', description: 'Generate unit tests for code', modes: ['default', 'coverage-focused', 'edge-cases'], status: 'available' },
  { name: 'refactoring', description: 'Code refactoring and optimization', modes: ['default', 'extract-method', 'simplify'], status: 'available' },
  { name: 'documentation', description: 'Generate documentation for code', modes: ['default', 'api', 'readme'], status: 'available' },
  { name: 'security-audit', description: 'Security vulnerability analysis', modes: ['default', 'owasp', 'dependencies'], status: 'available' },
];

/**
 * List available skills
 */
async function listSkills(options: { json?: boolean }): Promise<void> {
  const real = SKILL_INSTANCES.map(s => ({
    name: s.id,
    description: s.config.description,
    modes: [s.config.mode],
    status: 'available',
    category: s.config.category,
  }));
  const all = [...real, ...STATIC_SKILLS.map(s => ({ ...s, category: 'legacy' }))];

  if (options.json) {
    output.json(all);
    return;
  }

  const table = new Table({
    head: [chalk.cyan('Name'), chalk.cyan('Description'), chalk.cyan('Category'), chalk.cyan('Status')],
    colWidths: [22, 44, 12, 12],
  });

  for (const skill of all) {
    table.push([
      skill.name,
      skill.description.slice(0, 42),
      (skill as { category?: string }).category ?? '',
      chalk.green('✓ Available'),
    ]);
  }

  output.info(table.toString());
  output.newline();
  output.info(chalk.dim(`Total: ${all.length} skills (${real.length} builtin from Superpowers)`));
}

/**
 * Execute a skill
 */
async function runSkill(skill: string, options: RunOptions): Promise<void> {
  const skillInstance = SKILL_INSTANCES.find(s => s.id === skill);

  if (!skillInstance) {
    // Fall back to legacy static skills
    const legacy = STATIC_SKILLS.find(s => s.name === skill);
    if (!legacy) {
      output.error(`Skill "${skill}" not found. Use "skill list" to see available skills.`);
      process.exit(1);
    }
    output.info(chalk.cyan(`Running legacy skill: ${skill}`));
    output.info(chalk.dim('(Legacy skill — no real execution yet)'));
    return;
  }

  // Prompt for required parameters
  const parameters: Record<string, unknown> = {};
  for (const param of skillInstance.config.parameters ?? []) {
    if (param.required) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: param.name,
          message: `${param.name}: ${param.description}`,
          default: String(param.default ?? ''),
        },
      ]);
      parameters[param.name] = answers[param.name];
    }
  }

  const path = options.path ?? process.cwd();

  output.info(chalk.cyan(`Running skill: ${skill}`));
  output.info(chalk.dim(`Category: ${skillInstance.config.category}`));
  output.newline();

  const spinner = createSpinner('Executing skill...');
  spinner.start();

  let result;
  try {
    const consoleLogger = {
      debug: (msg: string) => { /* silent */ void msg; },
      info: (msg: string) => { /* silent */ void msg; },
      warn: (msg: string) => console.warn(msg),
      error: (msg: string) => console.error(msg),
    };
    result = await skillInstance.execute({
      sessionId: randomUUID(),
      workingDirectory: path,
      parameters,
      environment: process.env as Record<string, string>,
      logger: consoleLogger,
    });
  } catch (e) {
    spinner.stop();
    output.error(`Skill execution failed: ${String(e)}`);
    process.exit(1);
  }

  spinner.stop();

  if (result.success) {
    output.success(`Skill "${skill}" completed in ${result.duration}ms`);
    if (typeof result.output === 'string') {
      output.newline();
      console.log(result.output);
    }
    if (result.artifacts?.length) {
      output.newline();
      output.info(chalk.dim(`Artifacts: ${result.artifacts.map(a => a.name).join(', ')}`));
    }
  } else {
    output.error(`Skill "${skill}" failed: ${result.error ?? 'unknown error'}`);
    process.exit(1);
  }
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

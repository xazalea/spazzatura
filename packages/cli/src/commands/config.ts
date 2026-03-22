/**
 * Config command module
 * Configuration management — persists to ~/.spazzatura/config.json
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { output } from '../utils/output.js';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

export const configCommand = new Command('config')
  .description('Configuration management')
  .addCommand(
    new Command('list')
      .description('List all configuration')
      .option('--json', 'Output as JSON')
      .action(async (options: { json?: boolean }) => {
        await listConfig(options);
      })
  )
  .addCommand(
    new Command('get')
      .description('Get config value')
      .argument('<key>', 'Configuration key (dot-notation)')
      .action(async (key: string) => {
        await getConfig(key);
      })
  )
  .addCommand(
    new Command('set')
      .description('Set config value')
      .argument('<key>', 'Configuration key (dot-notation)')
      .argument('<value>', 'Configuration value')
      .action(async (key: string, value: string) => {
        await setConfig(key, value);
      })
  )
  .addCommand(
    new Command('init')
      .description('Initialize configuration file interactively')
      .option('-f, --force', 'Overwrite existing config')
      .action(async (options: { force?: boolean }) => {
        await initConfig(options);
      })
  )
  .addCommand(
    new Command('edit')
      .description('Edit config in $EDITOR')
      .action(async () => {
        await editConfig();
      })
  )
  .addCommand(
    new Command('validate')
      .description('Validate configuration')
      .action(async () => {
        await validateConfig();
      })
  )
  .addCommand(
    new Command('reset')
      .description('Reset to defaults')
      .option('--confirm', 'Skip confirmation')
      .action(async (options: { confirm?: boolean }) => {
        await resetConfig(options);
      })
  )
  .addCommand(
    new Command('path')
      .description('Show config file path')
      .action(() => {
        output.info(getConfigPath());
      })
  );

// ============================================================================
// Config file management
// ============================================================================

function getConfigDir(): string {
  return join(homedir(), '.spazzatura');
}

function getConfigPath(): string {
  return join(getConfigDir(), 'config.json');
}

interface SpazzaturaConfig {
  project?: {
    name?: string;
    version?: string;
  };
  providers?: {
    primary?: string;
    fallback?: string[];
    defaultModel?: string;
  };
  agents?: {
    defaultAgent?: string;
    coder?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    };
    reviewer?: {
      model?: string;
      temperature?: number;
    };
  };
  output?: {
    format?: string;
    logLevel?: string;
    streaming?: boolean;
  };
  history?: {
    enabled?: boolean;
    maxSize?: number;
  };
}

const DEFAULT_CONFIG: SpazzaturaConfig = {
  project: {
    name: 'my-project',
    version: '1.0.0',
  },
  providers: {
    primary: 'auto',
    fallback: ['openrouter', 'ollama', 'gpt4free'],
    defaultModel: 'auto',
  },
  agents: {
    defaultAgent: 'coder',
    coder: {
      model: 'auto',
      temperature: 0.7,
      maxTokens: 8192,
    },
    reviewer: {
      model: 'auto',
      temperature: 0.3,
    },
  },
  output: {
    format: 'colorful',
    logLevel: 'info',
    streaming: true,
  },
  history: {
    enabled: true,
    maxSize: 1000,
  },
};

function loadConfig(): SpazzaturaConfig {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    return JSON.parse(readFileSync(configPath, 'utf8')) as SpazzaturaConfig;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config: SpazzaturaConfig): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

function getNestedValue(obj: Record<string, unknown>, keys: string[]): unknown {
  let current: unknown = obj;
  for (const key of keys) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function setNestedValue(
  obj: Record<string, unknown>,
  keys: string[],
  value: unknown
): void {
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    if (typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  const lastKey = keys[keys.length - 1]!;
  current[lastKey] = value;
}

// ============================================================================
// Commands
// ============================================================================

async function listConfig(options: { json?: boolean }): Promise<void> {
  const config = loadConfig();

  if (options.json) {
    output.json(config);
    return;
  }

  const configPath = getConfigPath();
  output.info(chalk.cyan.bold('\nSpazzatura Configuration'));
  output.info(chalk.dim(`File: ${configPath}${existsSync(configPath) ? '' : ' (using defaults)'}`));
  output.info(chalk.dim('─'.repeat(50)));

  const printConfig = (obj: Record<string, unknown>, prefix = ''): void => {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        output.info(chalk.bold(`\n  ${fullKey}:`));
        printConfig(value as Record<string, unknown>, fullKey);
      } else {
        const displayValue = Array.isArray(value)
          ? chalk.green(`[${value.join(', ')}]`)
          : typeof value === 'string'
            ? chalk.green(`"${value}"`)
            : chalk.yellow(String(value));
        output.info(`  ${chalk.dim(fullKey)}: ${displayValue}`);
      }
    }
  };

  printConfig(config as Record<string, unknown>);
  output.newline();
}

async function getConfig(key: string): Promise<void> {
  const config = loadConfig();
  const keys = key.split('.');
  const value = getNestedValue(config as Record<string, unknown>, keys);

  if (value === undefined) {
    output.error(`Key "${key}" not found`);
    process.exit(1);
  }

  if (typeof value === 'object') {
    output.json(value);
  } else {
    output.info(String(value));
  }
}

async function setConfig(key: string, value: string): Promise<void> {
  const config = loadConfig();
  const keys = key.split('.');

  // Parse value: try JSON first, fallback to string
  let parsedValue: unknown = value;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    parsedValue = value;
  }

  setNestedValue(config as Record<string, unknown>, keys, parsedValue);
  saveConfig(config);

  output.success(`Set ${chalk.cyan(key)} = ${chalk.green(JSON.stringify(parsedValue))}`);
}

async function initConfig(options: { force?: boolean }): Promise<void> {
  const configPath = getConfigPath();

  if (existsSync(configPath) && !options.force) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Config already exists at ${configPath}. Overwrite?`,
        default: false,
      },
    ]);
    if (!overwrite) {
      output.info('Init cancelled.');
      return;
    }
  }

  output.info(chalk.cyan('Initializing Spazzatura configuration...'));
  output.newline();

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: DEFAULT_CONFIG.project?.name,
    },
    {
      type: 'list',
      name: 'primaryProvider',
      message: 'Primary LLM provider:',
      choices: [
        { name: 'Auto (uses best available)', value: 'auto' },
        { name: 'Anthropic Claude', value: 'anthropic' },
        { name: 'OpenAI', value: 'openai' },
        { name: 'OpenRouter (100+ models)', value: 'openrouter' },
        { name: 'Ollama (local, free)', value: 'ollama' },
        { name: 'GPT4Free (no key needed)', value: 'gpt4free' },
      ],
      default: 'auto',
    },
    {
      type: 'list',
      name: 'defaultAgent',
      message: 'Default agent:',
      choices: ['coder', 'reviewer', 'tester', 'analyst', 'sisyphus', 'hephaestus', 'prometheus'],
      default: 'coder',
    },
    {
      type: 'list',
      name: 'logLevel',
      message: 'Log level:',
      choices: ['debug', 'info', 'warn', 'error'],
      default: 'info',
    },
    {
      type: 'confirm',
      name: 'streaming',
      message: 'Enable streaming responses?',
      default: true,
    },
  ]);

  const config: SpazzaturaConfig = {
    ...DEFAULT_CONFIG,
    project: {
      name: answers.projectName as string,
      version: '1.0.0',
    },
    providers: {
      primary: answers.primaryProvider as string,
      fallback: ['openrouter', 'ollama', 'gpt4free'],
      defaultModel: 'auto',
    },
    agents: {
      defaultAgent: answers.defaultAgent as string,
      coder: DEFAULT_CONFIG.agents?.coder,
      reviewer: DEFAULT_CONFIG.agents?.reviewer,
    },
    output: {
      format: 'colorful',
      logLevel: answers.logLevel as string,
      streaming: answers.streaming as boolean,
    },
  };

  saveConfig(config);

  output.newline();
  output.success(`Configuration saved to: ${configPath}`);
  output.newline();
  output.info('Environment variables take precedence over config:');
  output.info(chalk.dim('  ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY'));
  output.info(chalk.dim('  SPAZZATURA_DEFAULT_PROVIDER, SPAZZATURA_DEFAULT_MODEL'));
  output.newline();
  output.info('Next steps:');
  output.info('  spazzatura chat "hello"');
  output.info('  spazzatura provider list');
}

async function editConfig(): Promise<void> {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    saveConfig(DEFAULT_CONFIG);
    output.info(chalk.dim(`Created default config: ${configPath}`));
  }

  const editor = process.env['EDITOR'] ?? process.env['VISUAL'] ?? 'vi';

  try {
    execSync(`${editor} "${configPath}"`, { stdio: 'inherit' });
    output.success('Config saved.');
  } catch {
    output.error(`Could not open editor: ${editor}`);
    output.info(`Edit manually: ${configPath}`);
  }
}

async function validateConfig(): Promise<void> {
  const config = loadConfig();
  const issues: string[] = [];

  // Check provider values
  const validProviders = ['auto', 'anthropic', 'openai', 'openrouter', 'ollama', 'minimax', 'qwen', 'gpt4free', 'glm'];
  const primary = config.providers?.primary;
  if (primary && !validProviders.includes(primary)) {
    issues.push(`Unknown primary provider: ${primary}`);
  }

  // Check log level
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  const logLevel = config.output?.logLevel;
  if (logLevel && !validLogLevels.includes(logLevel)) {
    issues.push(`Unknown log level: ${logLevel}`);
  }

  if (issues.length > 0) {
    output.error('Configuration validation failed:');
    for (const issue of issues) {
      output.info(chalk.red(`  ✗ ${issue}`));
    }
    process.exit(1);
  }

  output.success('Configuration is valid.');
  output.info(chalk.dim(`  File: ${getConfigPath()}`));
  output.info(chalk.dim(`  Primary provider: ${config.providers?.primary ?? 'auto'}`));
  output.info(chalk.dim(`  Default agent: ${config.agents?.defaultAgent ?? 'coder'}`));
}

async function resetConfig(options: { confirm?: boolean }): Promise<void> {
  if (!options.confirm) {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Reset all configuration to defaults?',
        default: false,
      },
    ]);
    if (!confirmed) {
      output.info('Reset cancelled.');
      return;
    }
  }

  saveConfig(DEFAULT_CONFIG);
  output.success('Configuration reset to defaults.');
}

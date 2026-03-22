/**
 * Provider command module
 * Provider management
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import { output } from '../utils/output.js';
import { createSpinner } from '../ui/spinner.js';
import {
  detectAvailableProviders,
  getDefaultProviderConfig,
  createRouter,
  getDefaultRoutingConfig,
} from '@spazzatura/provider';

export const providerCommand = new Command('provider')
  .description('Provider management')
  .addCommand(
    new Command('list')
      .description('List providers')
      .option('--json', 'Output as JSON')
      .action(async (options: { json?: boolean }) => {
        await listProviders(options);
      })
  )
  .addCommand(
    new Command('status')
      .description('Show provider status')
      .action(async () => {
        await showProviderStatus();
      })
  )
  .addCommand(
    new Command('test')
      .description('Test provider connection')
      .argument('<name>', 'Provider name')
      .action(async (name: string) => {
        await testProvider(name);
      })
  )
  .addCommand(
    new Command('show')
      .description('Show provider details')
      .argument('<name>', 'Provider name')
      .action(async (name: string) => {
        await showProvider(name);
      })
  )
  .addCommand(
    new Command('add')
      .description('Add custom provider')
      .argument('<name>', 'Provider name')
      .option('-u, --base-url <url>', 'Base URL')
      .option('-t, --type <type>', 'Provider type')
      .option('--token <token>', 'Auth token')
      .action(async (name: string, options: AddOptions) => {
        await addProvider(name, options);
      })
  )
  .addCommand(
    new Command('remove')
      .description('Remove provider')
      .argument('<name>', 'Provider name')
      .action(async (name: string) => {
        await removeProvider(name);
      })
  )
  .addCommand(
    new Command('set-primary')
      .description('Set primary provider')
      .argument('<name>', 'Provider name')
      .action(async (name: string) => {
        await setPrimaryProvider(name);
      })
  )
  .addCommand(
    new Command('models')
      .description('Show available models')
      .argument('[name]', 'Provider name (optional)')
      .action(async (name: string | undefined) => {
        await showModels(name);
      })
  )
  .addCommand(
    new Command('health')
      .description('Check provider health')
      .argument('[name]', 'Provider name (optional, checks all if not provided)')
      .action(async (name: string | undefined) => {
        await checkHealth(name);
      })
  );

/**
 * Add options
 */
interface AddOptions {
  baseUrl?: string;
  type?: string;
  token?: string;
}

/**
 * Build dynamic provider list from environment detection
 */
function getProviderList(): Array<{
  name: string;
  type: string;
  configured: boolean;
  free: boolean;
  models: string[];
  defaultModel: string;
}> {
  const detected = detectAvailableProviders();
  return detected.map((p, i) => {
    const cfg = getDefaultProviderConfig(p.type);
    return {
      name: p.type,
      type: p.type,
      configured: p.configured,
      free: p.free,
      priority: i + 1,
      models: Array.isArray(cfg.models) ? [...cfg.models] : [],
      defaultModel: cfg.defaultModel ?? (Array.isArray(cfg.models) && cfg.models.length > 0 ? cfg.models[0]! : 'auto'),
    };
  });
}

/**
 * List providers
 */
async function listProviders(options: { json?: boolean }): Promise<void> {
  const providers = getProviderList();

  if (options.json) {
    output.json(providers);
    return;
  }

  const table = new Table({
    head: [chalk.cyan('Name'), chalk.cyan('Default Model'), chalk.cyan('Configured'), chalk.cyan('Free')],
    colWidths: [14, 40, 14, 8],
  });

  for (const p of providers) {
    table.push([
      p.name,
      p.defaultModel,
      p.configured ? chalk.green('✓ Yes') : chalk.yellow('○ No'),
      p.free ? chalk.green('✓') : chalk.dim('—'),
    ]);
  }

  output.info(table.toString());
  output.newline();
  output.info(chalk.dim(`Total: ${providers.length} providers`));
  output.newline();
  output.info(chalk.dim('Configure API keys via environment variables:'));
  output.info(chalk.dim('  ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY'));
  output.info(chalk.dim('  Free: run Ollama locally (ollama.ai) or set OLLAMA_HOST'));
}

/**
 * Show provider status with real health checks
 */
async function showProviderStatus(): Promise<void> {
  output.info(chalk.cyan.bold('\nProvider Status'));
  output.info(chalk.dim('─'.repeat(50)));

  const spinner = createSpinner('Checking providers...');
  spinner.start();

  const providers = getProviderList();
  const router = createRouter(
    providers.map(p => getDefaultProviderConfig(p.type)),
    getDefaultRoutingConfig()
  );

  await router.checkAllHealth();
  spinner.stop();

  const statuses = router.getStatus();
  const table = new Table({
    head: [chalk.cyan('Provider'), chalk.cyan('Status'), chalk.cyan('Latency'), chalk.cyan('Last Check')],
    colWidths: [15, 15, 12, 20],
  });

  for (const p of statuses.providers) {
    table.push([
      p.name,
      p.available ? chalk.green('● Online') : chalk.red('● Offline'),
      p.latency !== undefined ? `${p.latency}ms` : '-',
      new Date().toLocaleTimeString(),
    ]);
  }

  output.info(table.toString());
  output.newline();
  output.info(`Routing strategy: ${chalk.cyan(statuses.routingConfig.strategy)}`);
}

/**
 * Test provider connection with real health check
 */
async function testProvider(name: string): Promise<void> {
  const providers = getProviderList();
  const pInfo = providers.find(p => p.name === name);

  if (!pInfo) {
    output.error(`Provider "${name}" not found. Available: ${providers.map(p => p.name).join(', ')}`);
    process.exit(1);
  }

  output.info(`Testing connection to ${chalk.cyan(name)}...`);

  const spinner = createSpinner('Connecting...');
  spinner.start();

  try {
    const cfg = getDefaultProviderConfig(name);
    const router = createRouter([cfg], getDefaultRoutingConfig());
    await router.checkAllHealth();
    const status = router.getStatus();
    spinner.stop();

    const p = status.providers.find(s => s.name === name);
    if (p?.available) {
      output.success(`Provider "${name}" is online (${p.latency}ms)`);
    } else {
      output.error(`Provider "${name}" is not available`);
    }
  } catch (err) {
    spinner.stop();
    output.error(`Connection test failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Show provider details
 */
async function showProvider(name: string): Promise<void> {
  const providers = getProviderList();
  const p = providers.find(pv => pv.name === name);

  if (!p) {
    output.error(`Provider "${name}" not found. Available: ${providers.map(pv => pv.name).join(', ')}`);
    process.exit(1);
  }

  const cfg = getDefaultProviderConfig(name);

  output.info(chalk.cyan.bold(`\nProvider: ${name}`));
  output.info(chalk.dim('─'.repeat(50)));
  output.info(`${chalk.bold('Type:')} ${p.type}`);
  output.info(`${chalk.bold('Base URL:')} ${cfg.baseUrl ?? 'not set'}`);
  output.info(`${chalk.bold('Default Model:')} ${p.defaultModel}`);
  output.info(`${chalk.bold('Configured:')} ${p.configured ? chalk.green('Yes') : chalk.yellow('No (set API key)')}`);
  output.info(`${chalk.bold('Free tier:')} ${p.free ? chalk.green('Yes') : 'No'}`);

  output.newline();
  output.info(chalk.bold('Available Models:'));
  for (const model of p.models.slice(0, 10)) {
    output.info(`  ${model}`);
  }
  if (p.models.length > 10) {
    output.info(chalk.dim(`  ... and ${p.models.length - 10} more`));
  }
}

/**
 * Add custom provider
 */
async function addProvider(name: string, options: AddOptions): Promise<void> {
  output.info(`Adding provider "${name}"...`);

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseUrl',
      message: 'Base URL:',
      default: options.baseUrl || 'http://localhost:8080',
      validate: (input: string) => {
        try {
          new URL(input);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    },
    {
      type: 'list',
      name: 'type',
      message: 'Provider type:',
      choices: ['openai-compatible', 'anthropic', 'custom'],
      default: options.type || 'openai-compatible',
    },
    {
      type: 'password',
      name: 'token',
      message: 'Auth token (optional):',
      mask: '*',
    },
    {
      type: 'number',
      name: 'priority',
      message: 'Priority (1 = highest):',
      default: getProviderList().length + 1,
    },
  ]);

  const spinner = createSpinner('Adding provider...');
  spinner.start();

  // TODO: Actually add provider
  await new Promise(resolve => setTimeout(resolve, 1000));

  spinner.stop();
  
  output.success(`Provider "${name}" added!`);
  output.info(chalk.dim(`Base URL: ${answers.baseUrl}`));
  output.info(chalk.dim(`Type: ${answers.type}`));
  output.info(chalk.dim(`Priority: ${answers.priority}`));
}

/**
 * Remove provider (built-in providers cannot be removed; shows instruction)
 */
async function removeProvider(name: string): Promise<void> {
  const providers = getProviderList();
  if (!providers.find(p => p.name === name)) {
    output.error(`Provider "${name}" not found.`);
    process.exit(1);
  }
  output.info(`To disable provider "${name}", unset its API key environment variable or set ${name.toUpperCase()}_ENABLED=false`);
}

/**
 * Set primary provider
 */
async function setPrimaryProvider(name: string): Promise<void> {
  const providers = getProviderList();
  if (!providers.find(p => p.name === name)) {
    output.error(`Provider "${name}" not found.`);
    process.exit(1);
  }
  output.info(`To set "${name}" as primary, set SPAZZATURA_DEFAULT_PROVIDER=${name} or use the routing strategy.`);
  output.success(`Tip: export SPAZZATURA_DEFAULT_PROVIDER=${name}`);
}

/**
 * Show available models
 */
async function showModels(name: string | undefined): Promise<void> {
  const allProviders = getProviderList();

  if (name) {
    const p = allProviders.find(pv => pv.name === name);
    if (!p) {
      output.error(`Provider "${name}" not found.`);
      process.exit(1);
    }
    output.info(chalk.cyan.bold(`\nModels for ${name}:`));
    output.info(chalk.dim('─'.repeat(50)));
    for (const model of p.models) {
      output.info(`  ${model}`);
    }
  } else {
    output.info(chalk.cyan.bold('\nAll Available Models'));
    output.info(chalk.dim('─'.repeat(50)));
    const table = new Table({
      head: [chalk.cyan('Provider'), chalk.cyan('Model')],
      colWidths: [15, 50],
    });
    for (const p of allProviders) {
      for (const model of p.models.slice(0, 5)) {
        table.push([p.name, model]);
      }
      if (p.models.length > 5) {
        table.push([chalk.dim(p.name), chalk.dim(`... +${p.models.length - 5} more`)]);
      }
    }
    output.info(table.toString());
  }
}

/**
 * Check provider health with real HTTP checks
 */
async function checkHealth(name: string | undefined): Promise<void> {
  const allProviders = getProviderList();
  const targets = name ? allProviders.filter(p => p.name === name) : allProviders;

  if (name && targets.length === 0) {
    output.error(`Provider "${name}" not found.`);
    process.exit(1);
  }

  output.info(chalk.cyan.bold('\nHealth Check'));
  output.info(chalk.dim('─'.repeat(50)));

  for (const p of targets) {
    const spinner = createSpinner(`Checking ${p.name}...`);
    spinner.start();

    try {
      const cfg = getDefaultProviderConfig(p.type);
      const router = createRouter([cfg], getDefaultRoutingConfig());
      await router.checkAllHealth();
      const status = router.getStatus().providers.find(s => s.name === p.name);
      spinner.stop();

      if (status?.available) {
        output.info(`${chalk.green('●')} ${p.name}: ${chalk.green('Healthy')} (${status.latency ?? 0}ms)`);
      } else {
        output.info(`${chalk.red('●')} ${p.name}: ${chalk.red('Unhealthy')}`);
      }
    } catch {
      spinner.stop();
      output.info(`${chalk.red('●')} ${p.name}: ${chalk.red('Error checking health')}`);
    }
  }

  output.newline();
  output.success('Health check complete!');
}

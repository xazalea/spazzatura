/**
 * MCP command module
 * MCP server management
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import { output } from '../utils/output.js';
import { createSpinner } from '../ui/spinner.js';

export const mcpCommand = new Command('mcp')
  .description('MCP server management')
  .addCommand(
    new Command('list')
      .description('List MCP servers')
      .option('--json', 'Output as JSON')
      .action(async (options: { json?: boolean }) => {
        await listMCPServers(options);
      })
  )
  .addCommand(
    new Command('add')
      .description('Add MCP server')
      .argument('<name>', 'Server name')
      .option('-c, --command <command>', 'Server command')
      .option('-a, --args <args>', 'Comma-separated arguments')
      .option('-e, --env <env>', 'JSON environment variables')
      .action(async (name: string, options: AddOptions) => {
        await addMCPServer(name, options);
      })
  )
  .addCommand(
    new Command('remove')
      .description('Remove MCP server')
      .argument('<name>', 'Server name')
      .action(async (name: string) => {
        await removeMCPServer(name);
      })
  )
  .addCommand(
    new Command('start')
      .description('Start MCP server')
      .argument('<name>', 'Server name')
      .action(async (name: string) => {
        await startMCPServer(name);
      })
  )
  .addCommand(
    new Command('stop')
      .description('Stop MCP server')
      .argument('<name>', 'Server name')
      .action(async (name: string) => {
        await stopMCPServer(name);
      })
  )
  .addCommand(
    new Command('status')
      .description('Show MCP server status')
      .argument('[name]', 'Server name (optional, shows all if not provided)')
      .action(async (name: string | undefined) => {
        await showMCPStatus(name);
      })
  )
  .addCommand(
    new Command('tools')
      .description('List available tools from server')
      .argument('<name>', 'Server name')
      .action(async (name: string) => {
        await listMCPTools(name);
      })
  )
  .addCommand(
    new Command('call')
      .description('Call MCP tool directly')
      .argument('<server>', 'Server name')
      .argument('<tool>', 'Tool name')
      .option('-p, --params <params>', 'JSON parameters')
      .action(async (server: string, tool: string, options: CallOptions) => {
        await callMCPTool(server, tool, options);
      })
  );

/**
 * Add options
 */
interface AddOptions {
  command?: string;
  args?: string;
  env?: string;
}

/**
 * Call options
 */
interface CallOptions {
  params?: string;
}

/**
 * Known MCP servers
 */
const MCP_SERVERS = [
  {
    name: 'filesystem',
    command: 'mcp-filesystem',
    description: 'File system operations',
    status: 'stopped',
    tools: ['read_file', 'write_file', 'list_directory', 'search_files'],
  },
  {
    name: 'github',
    command: 'mcp-github',
    description: 'GitHub API integration',
    status: 'stopped',
    tools: ['create_issue', 'create_pr', 'search_repos', 'get_file'],
  },
  {
    name: 'memory',
    command: 'mcp-memory',
    description: 'Persistent memory storage',
    status: 'stopped',
    tools: ['store', 'retrieve', 'search', 'clear'],
  },
  {
    name: 'postgres',
    command: 'mcp-postgres',
    description: 'PostgreSQL database',
    status: 'stopped',
    tools: ['query', 'insert', 'update', 'delete', 'schema'],
  },
  {
    name: 'brave',
    command: 'mcp-brave-search',
    description: 'Brave search integration',
    status: 'stopped',
    tools: ['search', 'news', 'images'],
  },
];

/**
 * List MCP servers
 */
async function listMCPServers(options: { json?: boolean }): Promise<void> {
  if (options.json) {
    output.json(MCP_SERVERS);
    return;
  }

  const table = new Table({
    head: [chalk.cyan('Name'), chalk.cyan('Description'), chalk.cyan('Status'), chalk.cyan('Tools')],
    colWidths: [15, 30, 12, 30],
  });

  for (const server of MCP_SERVERS) {
    table.push([
      server.name,
      server.description,
      server.status === 'running' ? chalk.green('● Running') : chalk.dim('○ Stopped'),
      server.tools.slice(0, 3).join(', ') + (server.tools.length > 3 ? '...' : ''),
    ]);
  }

  output.info(table.toString());
  output.newline();
  output.info(chalk.dim(`Total: ${MCP_SERVERS.length} servers`));
}

/**
 * Add MCP server
 */
async function addMCPServer(name: string, options: AddOptions): Promise<void> {
  output.info(`Adding MCP server "${name}"...`);

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'command',
      message: 'Server command:',
      default: options.command,
      validate: (input: string) => input.length > 0 || 'Command is required',
    },
    {
      type: 'input',
      name: 'args',
      message: 'Arguments (comma-separated):',
      default: options.args,
    },
    {
      type: 'confirm',
      name: 'configureEnv',
      message: 'Configure environment variables?',
      default: false,
    },
  ]);

  let env: Record<string, string> = {};
  
  if (answers.configureEnv) {
    const envAnswers = await inquirer.prompt([
      {
        type: 'editor',
        name: 'env',
        message: 'Environment variables (JSON):',
        default: options.env || '{}',
      },
    ]);
    
    try {
      env = JSON.parse(envAnswers.env);
    } catch {
      output.error('Invalid JSON for environment variables');
      return;
    }
  }

  const spinner = createSpinner('Adding server...');
  spinner.start();

  // TODO: Actually add server configuration
  await new Promise(resolve => setTimeout(resolve, 1000));

  spinner.stop();
  
  output.success(`MCP server "${name}" added!`);
  output.info(chalk.dim(`Command: ${answers.command}`));
  if (answers.args) {
    output.info(chalk.dim(`Args: ${answers.args}`));
  }
}

/**
 * Remove MCP server
 */
async function removeMCPServer(name: string): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to remove "${name}"?`,
      default: false,
    },
  ]);

  if (!answers.confirm) {
    output.info('Cancelled.');
    return;
  }

  const spinner = createSpinner('Removing server...');
  spinner.start();

  // TODO: Actually remove server
  await new Promise(resolve => setTimeout(resolve, 500));

  spinner.stop();
  
  output.success(`MCP server "${name}" removed!`);
}

/**
 * Start MCP server
 */
async function startMCPServer(name: string): Promise<void> {
  const server = MCP_SERVERS.find(s => s.name === name);
  
  if (!server) {
    output.error(`Server "${name}" not found.`);
    process.exit(1);
  }

  output.info(`Starting MCP server "${name}"...`);
  
  const spinner = createSpinner('Starting...');
  spinner.start();

  // TODO: Actually start server
  await new Promise(resolve => setTimeout(resolve, 1500));

  spinner.stop();
  
  output.success(`MCP server "${name}" started!`);
  output.info(chalk.dim(`Available tools: ${server.tools.join(', ')}`));
}

/**
 * Stop MCP server
 */
async function stopMCPServer(name: string): Promise<void> {
  output.info(`Stopping MCP server "${name}"...`);
  
  const spinner = createSpinner('Stopping...');
  spinner.start();

  // TODO: Actually stop server
  await new Promise(resolve => setTimeout(resolve, 500));

  spinner.stop();
  
  output.success(`MCP server "${name}" stopped!`);
}

/**
 * Show MCP server status
 */
async function showMCPStatus(name: string | undefined): Promise<void> {
  if (name) {
    const server = MCP_SERVERS.find(s => s.name === name);
    
    if (!server) {
      output.error(`Server "${name}" not found.`);
      process.exit(1);
    }

    output.info(chalk.cyan.bold(`\nServer: ${server.name}`));
    output.info(chalk.dim('─'.repeat(50)));
    output.info(`${chalk.bold('Description:')} ${server.description}`);
    output.info(`${chalk.bold('Command:')} ${server.command}`);
    output.info(`${chalk.bold('Status:')} ${server.status === 'running' ? chalk.green('● Running') : chalk.dim('○ Stopped')}`);
    output.info(`${chalk.bold('Tools:')} ${server.tools.join(', ')}`);
    output.newline();
  } else {
    output.info(chalk.cyan.bold('\nMCP Server Status'));
    output.info(chalk.dim('─'.repeat(50)));
    
    const table = new Table({
      head: [chalk.cyan('Name'), chalk.cyan('Status'), chalk.cyan('PID')],
      colWidths: [20, 15, 10],
    });

    for (const server of MCP_SERVERS) {
      table.push([
        server.name,
        server.status === 'running' ? chalk.green('● Running') : chalk.dim('○ Stopped'),
        server.status === 'running' ? '12345' : '-',
      ]);
    }

    output.info(table.toString());
  }
}

/**
 * List MCP tools
 */
async function listMCPTools(name: string): Promise<void> {
  const server = MCP_SERVERS.find(s => s.name === name);
  
  if (!server) {
    output.error(`Server "${name}" not found.`);
    process.exit(1);
  }

  output.info(chalk.cyan.bold(`\nTools available from "${name}":`));
  output.info(chalk.dim('─'.repeat(50)));

  for (const tool of server.tools) {
    output.info(`  ${chalk.green('•')} ${tool}`);
  }
  
  output.newline();
  output.info(chalk.dim(`Total: ${server.tools.length} tools`));
}

/**
 * Call MCP tool
 */
async function callMCPTool(server: string, tool: string, options: CallOptions): Promise<void> {
  output.info(chalk.cyan(`Calling ${server}.${tool}...`));
  
  let params = {};
  
  if (options.params) {
    try {
      params = JSON.parse(options.params);
    } catch {
      output.error('Invalid JSON parameters');
      process.exit(1);
    }
  } else {
    const answers = await inquirer.prompt([
      {
        type: 'editor',
        name: 'params',
        message: 'Enter parameters (JSON):',
        default: '{}',
      },
    ]);
    
    try {
      params = JSON.parse(answers.params);
    } catch {
      output.error('Invalid JSON parameters');
      process.exit(1);
    }
  }

  const spinner = createSpinner('Executing...');
  spinner.start();

  // TODO: Actually call MCP tool
  await new Promise(resolve => setTimeout(resolve, 1500));

  spinner.stop();
  
  output.success('Tool executed successfully!');
  output.newline();
  output.info(chalk.bold('Result:'));
  output.json({ success: true, data: 'MCP integration coming soon' });
}

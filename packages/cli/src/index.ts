/**
 * @spazzatura/cli
 * CLI entry point for Spazzatura
 */

import { Command } from 'commander';
import { startREPL } from './repl.js';
export { startREPL } from './repl.js';
import { startTUI } from './tui/index.js';
import { chatCommand } from './commands/chat.js';
import { agentCommand } from './commands/agent.js';
import { skillCommand } from './commands/skill.js';
import { specCommand } from './commands/spec.js';
import { mcpCommand } from './commands/mcp.js';
import { templateCommand } from './commands/template.js';
import { configCommand } from './commands/config.js';
import { providerCommand } from './commands/provider.js';

// Version is injected at build time by tsup define — no runtime file reads needed
declare const __SPAZ_VERSION__: string;
const VERSION = (typeof __SPAZ_VERSION__ !== 'undefined' ? __SPAZ_VERSION__ : '0.2.0');

/**
 * Global options interface
 */
export interface GlobalOptions {
  config?: string;
  provider?: string;
  model?: string;
  temperature?: number;
  stream?: boolean;
  output?: 'colorful' | 'plain' | 'json';
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  debug?: boolean;
  tui?: boolean;
}

/**
 * Create the main CLI program
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name('spazzatura')
    .description('Unified CLI coding tool with AI-powered agents, skills, and spec-driven development')
    .version(VERSION, '-v, --version', 'Show version number')
    .option('-c, --config <path>', 'Path to config file')
    .option('-p, --provider <name>', 'Override provider')
    .option('-m, --model <name>', 'Override model')
    .option('-t, --temperature <number>', 'Override temperature', parseFloat)
    .option('--no-stream', 'Disable streaming output')
    .option('-o, --output <format>', 'Output format (colorful, plain, json)')
    .option('-l, --log-level <level>', 'Log level (debug, info, warn, error)')
    .option('--debug', 'Enable debug mode')
    .option('--no-tui', 'Disable TUI, use plain REPL');

  // Default action - start TUI (falls back to REPL if ink unavailable)
  program.action(async (options: GlobalOptions) => {
    if (options.tui === false) {
      await startREPL(options);
    } else {
      await startTUI({
        ...(options.provider !== undefined ? { provider: options.provider } : {}),
        ...(options.model !== undefined ? { model: options.model } : {}),
        globalOptions: options,
      });
    }
  });

  // Register subcommands
  program.addCommand(chatCommand);
  program.addCommand(agentCommand);
  program.addCommand(skillCommand);
  program.addCommand(specCommand);
  program.addCommand(mcpCommand);
  program.addCommand(templateCommand);
  program.addCommand(configCommand);
  program.addCommand(providerCommand);

  // Help configuration
  program.helpOption('-h, --help', 'Show help');
  program.addHelpCommand('help [command]', 'Show help for command');

  // Custom help text
  program.addHelpText('after', `
Examples:
  $ spazzatura                          Start interactive REPL
  $ spazzatura chat "Explain this"      Single chat message
  $ spazzatura agent run coder          Run the coder agent
  $ spazzatura skill run code-review    Execute code review skill
  $ spazzatura spec init                Initialize spec project

Documentation: https://github.com/spazzatura/spazzatura
`);

  return program;
}

/**
 * Main entry point
 */
export async function main(): Promise<void> {
  const program = createProgram();
  
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Export version
export { VERSION };

// Always run main — this file is always the CLI entry point
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

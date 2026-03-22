/**
 * CLI command template
 */

import type { BuiltinTemplate } from '../types.js';

export const cliCommand: BuiltinTemplate = {
  id: 'cli-command',
  aliases: ['command', 'cmd'],
  template: {
    name: 'cli-command',
    version: '1.0.0',
    description: 'CLI command with argument parsing and help text',
    author: 'Spazzatura',
    tags: ['cli', 'command', 'commander', 'yargs'],
    category: 'cli',
    variables: [
      {
        name: 'commandName',
        type: 'string',
        description: 'Name of the command (kebab-case)',
        required: true,
        validation: {
          pattern: '^[a-z][a-z0-9-]*$',
          message: 'Command name must be kebab-case (e.g., my-command)',
        },
      },
      {
        name: 'description',
        type: 'string',
        description: 'Command description',
        required: true,
      },
      {
        name: 'framework',
        type: 'select',
        description: 'CLI framework',
        required: true,
        default: 'commander',
        options: [
          { label: 'Commander', value: 'commander' },
          { label: 'Yargs', value: 'yargs' },
          { label: 'Native', value: 'native' },
        ],
      },
      {
        name: 'includeOptions',
        type: 'boolean',
        description: 'Include option parsing examples',
        required: false,
        default: true,
      },
      {
        name: 'includeSubcommands',
        type: 'boolean',
        description: 'Include subcommand support',
        required: false,
        default: false,
      },
      {
        name: 'includeHelp',
        type: 'boolean',
        description: 'Include custom help formatting',
        required: false,
        default: true,
      },
      {
        name: 'isAsync',
        type: 'boolean',
        description: 'Use async/await for command handler',
        required: false,
        default: true,
      },
    ],
    files: [
      {
        path: 'src/commands/{{kebabCase commandName}}.ts',
        content: `/**
 * {{commandName}} command
 * {{description}}
 */

{{#if (eq framework "commander")}}
import { Command } from 'commander';
{{else if (eq framework "yargs")}}
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
{{else}}
import { parseArgs } from 'node:util';
{{/if}}

{{#if (eq framework "commander")}}
/**
 * Create the {{commandName}} command
 */
export function create{{pascalCase commandName}}Command(): Command {
  const command = new Command('{{commandName}}')
    .description('{{description}}')
{{#if includeOptions}}
    .option('-v, --verbose', 'Enable verbose output', false)
    .option('-q, --quiet', 'Suppress non-essential output', false)
    .option('-o, --output <file>', 'Output file path')
    .option('-f, --format <format>', 'Output format', 'json')
{{/if}}
    .action({{#if isAsync}}async {{/if}}(options) => {
      {{#if isAsync}}await {{/if}}execute{{pascalCase commandName}}(options);
    });

{{#if includeHelp}}
  command.addHelpText('after', \`

Examples:
  $ cli {{commandName}}{{#if includeOptions}} --verbose{{/if}}
  $ cli {{commandName}}{{#if includeOptions}} --output result.txt{{/if}}
\`);
{{/if}}

  return command;
}

{{else if (eq framework "yargs")}}
/**
 * {{commandName}} command handler
 */
{{#if isAsync}}async {{/if}}function handler(argv: yargs.Arguments) {
  {{#if isAsync}}await {{/if}}execute{{pascalCase commandName}}({
    verbose: argv.verbose as boolean,
    quiet: argv.quiet as boolean,
    output: argv.output as string | undefined,
    format: argv.format as string,
  });
}

/**
 * Register the {{commandName}} command with yargs
 */
export function register{{pascalCase commandName}}Command(y: yargs.Argv): yargs.Argv {
  return y.command(
    '{{commandName}}',
    '{{description}}',
    (yargs) => {
      return yargs
{{#if includeOptions}}
        .option('verbose', {
          alias: 'v',
          type: 'boolean',
          description: 'Enable verbose output',
          default: false,
        })
        .option('quiet', {
          alias: 'q',
          type: 'boolean',
          description: 'Suppress non-essential output',
          default: false,
        })
        .option('output', {
          alias: 'o',
          type: 'string',
          description: 'Output file path',
        })
        .option('format', {
          alias: 'f',
          type: 'string',
          description: 'Output format',
          default: 'json',
        })
{{/if}}
{{#if includeHelp}}
        .example('$0 {{commandName}}{{#if includeOptions}} --verbose{{/if}}', 'Run with verbose output')
        .example('$0 {{commandName}}{{#if includeOptions}} --output result.txt{{/if}}', 'Save output to file')
{{/if}}
    },
    handler
  );
}

{{else}}
/**
 * Native Node.js {{commandName}} command
 */
export {{#if isAsync}}async {{/if}}function {{camelCase commandName}}Command(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
{{#if includeOptions}}
      verbose: {
        type: 'boolean',
        short: 'v',
        default: false,
      },
      quiet: {
        type: 'boolean',
        short: 'q',
        default: false,
      },
      output: {
        type: 'string',
        short: 'o',
      },
      format: {
        type: 'string',
        short: 'f',
        default: 'json',
      },
{{/if}}
      help: {
        type: 'boolean',
        short: 'h',
        default: false,
      },
    },
    allowPositionals: true,
  });

  if (values.help) {
    printHelp();
    return;
  }

  {{#if isAsync}}await {{/if}}execute{{pascalCase commandName}}({
    verbose: values.verbose,
    quiet: values.quiet,
    output: values.output,
    format: values.format,
  });
}

/**
 * Print help text
 */
function printHelp(): void {
  console.log(\`
Usage: cli {{commandName}} [options]

{{description}}

Options:
{{#if includeOptions}}
  -v, --verbose     Enable verbose output
  -q, --quiet       Suppress non-essential output
  -o, --output      Output file path
  -f, --format      Output format (default: json)
{{/if}}
  -h, --help        Show this help message

Examples:
  cli {{commandName}}{{#if includeOptions}} --verbose{{/if}}
  cli {{commandName}}{{#if includeOptions}} --output result.txt{{/if}}
\`);
}

{{/if}}
/**
 * Execute the {{commandName}} command
 */
{{#if isAsync}}async {{/if}}function execute{{pascalCase commandName}}(options: {
  verbose?: boolean;
  quiet?: boolean;
  output?: string;
  format?: string;
}): Promise<void> {
  // Implementation goes here
  if (!options.quiet) {
    console.log('Executing {{commandName}}...');
  }

  if (options.verbose) {
    console.log('Options:', options);
  }

  // Add your command logic here
}

{{#if (eq framework "commander")}}
export default create{{pascalCase commandName}}Command;
{{else if (eq framework "yargs")}}
export default register{{pascalCase commandName}}Command;
{{else}}
export default {{camelCase commandName}}Command;
{{/if}}
`,
      },
    ],
  },
};

export default cliCommand;

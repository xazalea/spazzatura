/**
 * Chat command module
 * Interactive AI chat command
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { startREPL, GlobalOptions } from '../index.js';
import { createSpinner } from '../ui/spinner.js';
import { formatMarkdown } from '../ui/markdown.js';
import { output } from '../utils/output.js';
import {
  createRouter,
  getDefaultRoutingConfig,
  getDefaultProviderConfig,
  detectAvailableProviders,
} from '@spazzatura/provider';

export const chatCommand = new Command('chat')
  .description('Interactive chat with AI')
  .argument('[prompt]', 'Single chat message (starts REPL if not provided)')
  .option('-m, --model <name>', 'Model to use')
  .option('-p, --provider <name>', 'Provider to use')
  .option('-t, --temperature <number>', 'Temperature setting', parseFloat)
  .option('--system <prompt>', 'System prompt')
  .option('-f, --file <path>', 'Include file context')
  .option('--no-stream', 'Disable streaming output')
  .option('--json', 'Output as JSON')
  .action(async (prompt: string | undefined, options: ChatOptions) => {
    try {
      if (prompt) {
        // Single message mode
        await handleSingleChat(prompt, options);
      } else {
        // Start interactive REPL
        await startREPL({
          provider: options.provider,
          model: options.model,
          temperature: options.temperature,
          stream: options.stream,
        });
      }
    } catch (error) {
      output.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Chat command options
 */
export interface ChatOptions extends GlobalOptions {
  model?: string;
  provider?: string;
  temperature?: number;
  system?: string;
  file?: string;
  stream?: boolean;
  json?: boolean;
}

/**
 * Build a provider router from chat options
 */
function buildChatRouter(options: ChatOptions) {
  const available = detectAvailableProviders();
  const providerConfigs = [];

  for (const p of available) {
    if (p.configured || p.free) {
      try {
        const cfg = getDefaultProviderConfig(p.type);
        providerConfigs.push(cfg);
      } catch {
        // skip
      }
    }
  }

  if (options.provider && options.provider !== 'auto') {
    const idx = providerConfigs.findIndex(p => p.name === options.provider);
    if (idx > 0) {
      const [prov] = providerConfigs.splice(idx, 1);
      if (prov) providerConfigs.unshift(prov);
    } else if (idx === -1) {
      // Try adding the requested provider anyway
      try {
        providerConfigs.unshift(getDefaultProviderConfig(options.provider));
      } catch { /* skip */ }
    }
  }

  return createRouter(providerConfigs, getDefaultRoutingConfig());
}

/**
 * Handle single chat message
 */
async function handleSingleChat(prompt: string, options: ChatOptions): Promise<void> {
  const router = buildChatRouter(options);

  // Build messages
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (options.system) {
    messages.push({ role: 'system', content: options.system });
  } else {
    messages.push({ role: 'system', content: 'You are Spazzatura, an expert AI coding assistant. Be concise and accurate.' });
  }

  let userPrompt = prompt;
  if (options.file) {
    const { readFileSync } = await import('fs');
    try {
      const fileContent = readFileSync(options.file, 'utf8');
      userPrompt = `${prompt}\n\n<file path="${options.file}">\n${fileContent}\n</file>`;
    } catch {
      output.error(`Could not read file: ${options.file}`);
      process.exit(1);
    }
  }
  messages.push({ role: 'user', content: userPrompt });

  const chatOptions = {
    ...(options.model ? { model: options.model } : {}),
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.provider && options.provider !== 'auto' ? { preferredProvider: options.provider } : {}),
  };

  if (options.stream !== false) {
    output.newline();
    process.stdout.write(chalk.dim('Assistant: '));

    let fullResponse = '';
    try {
      for await (const chunk of router.stream(messages, chatOptions)) {
        if (chunk.delta) {
          process.stdout.write(chunk.delta);
          fullResponse += chunk.delta;
        }
        if (chunk.done) break;
      }
    } catch (err) {
      output.newline();
      output.error(`Provider error: ${err instanceof Error ? err.message : String(err)}`);
      output.info(chalk.dim('Tip: Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY, or run Ollama locally.'));
      process.exit(1);
    }

    output.newline();
    output.newline();

    if (options.json) {
      output.json({ prompt, response: fullResponse });
    }
  } else {
    const spinner = createSpinner('Thinking...');
    spinner.start();

    try {
      const response = await router.chat(messages, chatOptions);
      spinner.stop();

      if (options.json) {
        output.json({ prompt, response: response.content, model: response.model });
      } else {
        output.info(chalk.dim('Assistant:'));
        output.info(formatMarkdown(response.content));
        output.newline();
      }
    } catch (err) {
      spinner.stop();
      output.error(`Provider error: ${err instanceof Error ? err.message : String(err)}`);
      output.info(chalk.dim('Tip: Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY, or run Ollama locally.'));
      process.exit(1);
    }
  }
}

/**
 * Interactive chat prompts
 */
export async function promptForChatOptions(): Promise<ChatOptions> {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Select provider:',
      choices: [
        { name: 'Auto (recommended)', value: 'auto' },
        { name: 'MiniMax', value: 'minimax' },
        { name: 'Qwen', value: 'qwen' },
        { name: 'GPT4Free', value: 'gpt4free' },
        { name: 'GLM', value: 'glm' },
      ],
      default: 'auto',
    },
    {
      type: 'list',
      name: 'model',
      message: 'Select model:',
      choices: (answers) => {
        // TODO: Get actual models from provider
        if (answers.provider === 'auto') {
          return [
            { name: 'Auto (recommended)', value: 'auto' },
            { name: 'Qwen Max', value: 'qwen-max' },
            { name: 'GLM-4 Plus', value: 'glm-4-plus' },
          ];
        }
        return [
          { name: 'Default', value: 'default' },
        ];
      },
      default: 'auto',
    },
    {
      type: 'confirm',
      name: 'stream',
      message: 'Enable streaming output?',
      default: true,
    },
  ]);

  return answers;
}

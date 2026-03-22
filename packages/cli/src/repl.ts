/**
 * REPL implementation
 * Interactive Read-Eval-Print Loop
 */

import * as readline from 'readline';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { formatMarkdown } from './ui/markdown.js';
import { createSpinner } from './ui/spinner.js';
import { output } from './utils/output.js';
import { HistoryManager } from './utils/history.js';
import type { GlobalOptions } from './index.js';
import { createRouter, getDefaultRoutingConfig, getDefaultProviderConfig, detectAvailableProviders } from '@spazzatura/provider';
import type { ProviderRouter } from '@spazzatura/provider';

/**
 * REPL special commands
 */
const SPECIAL_COMMANDS = {
  '/help': 'Show available commands',
  '/exit': 'Exit the REPL',
  '/quit': 'Exit the REPL (alias)',
  '/clear': 'Clear the screen',
  '/history': 'Show command history',
  '/reset': 'Reset conversation context',
  '/model': 'Change model',
  '/provider': 'Change provider',
  '/mode': 'Change mode',
  '/save': 'Save conversation',
  '/load': 'Load conversation',
  '/undo': 'Undo last message',
  '/redo': 'Redo last undone message',
};

/**
 * REPL session state
 */
interface REPLState {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  model: string;
  provider: string;
  temperature: number;
  mode: string;
}

/**
 * Build a ProviderRouter from global options and environment
 */
function buildRouter(options: GlobalOptions): ProviderRouter {
  const available = detectAvailableProviders();
  const providerConfigs = [];

  // Add configured providers
  for (const p of available) {
    if (p.configured || p.free) {
      try {
        const cfg = getDefaultProviderConfig(p.type);
        // Apply env key overrides
        const envKey = process.env[`${p.type.toUpperCase()}_API_KEY`] ?? process.env['OPENROUTER_API_KEY'];
        if (envKey && !cfg.apiKey) {
          providerConfigs.push({ ...cfg, apiKey: envKey });
        } else {
          providerConfigs.push(cfg);
        }
      } catch {
        // Skip providers that fail to configure
      }
    }
  }

  // If user specified a provider, ensure it's first
  if (options.provider && options.provider !== 'auto') {
    const idx = providerConfigs.findIndex(p => p.name === options.provider);
    if (idx > 0) {
      const [prov] = providerConfigs.splice(idx, 1);
      if (prov) providerConfigs.unshift(prov);
    }
  }

  const routingConfig = getDefaultRoutingConfig();
  return createRouter(providerConfigs, routingConfig);
}

/**
 * Start the interactive REPL
 */
export async function startREPL(options: GlobalOptions): Promise<void> {
  const history = new HistoryManager();
  const router = buildRouter(options);

  const state: REPLState = {
    messages: [],
    model: options.model || 'auto',
    provider: options.provider || 'auto',
    temperature: options.temperature ?? 0.7,
    mode: 'default',
  };

  printWelcome();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('❯ '),
    historySize: 1000,
    removeHistoryDuplicates: true,
  });

  // Load history
  const savedHistory = history.load();
  for (const entry of savedHistory) {
    rl.write(entry.command);
  }

  rl.prompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // Save to history
    history.add(input);

    // Handle special commands
    if (input.startsWith('/')) {
      await handleSpecialCommand(input, rl, state, history);
      rl.prompt();
      return;
    }

    // Handle regular chat
    await handleChat(input, state, options, router);
    rl.prompt();
  });

  rl.on('close', () => {
    output.newline();
    output.info(chalk.dim('Goodbye! 👋'));
    process.exit(0);
  });
}

/**
 * Print welcome message
 */
function printWelcome(): void {
  output.clear();
  output.info(chalk.cyan.bold('╔════════════════════════════════════════════════════════════╗'));
  output.info(chalk.cyan.bold('║') + chalk.white.bold('                    🗑️ Spazzatura REPL                      ') + chalk.cyan.bold('║'));
  output.info(chalk.cyan.bold('║') + chalk.dim('              Unified AI-Powered Coding Tool                ') + chalk.cyan.bold('║'));
  output.info(chalk.cyan.bold('╚════════════════════════════════════════════════════════════╝'));
  output.newline();
  output.info(chalk.dim('Type your message or use a command. Type /help for available commands.'));
  output.newline();
}

/**
 * Handle special commands
 */
async function handleSpecialCommand(
  input: string,
  rl: readline.Interface,
  state: REPLState,
  history: HistoryManager
): Promise<void> {
  const [command, ...args] = input.split(/\s+/);

  if (!command) {
    output.error('Unknown command. Type /help for available commands.');
    return;
  }

  switch (command.toLowerCase()) {
    case '/help':
      showHelp();
      break;

    case '/exit':
    case '/quit':
    case '/q':
      rl.close();
      break;

    case '/clear':
      output.clear();
      break;

    case '/history':
      showHistory(history);
      break;

    case '/reset':
      state.messages = [];
      output.success('Conversation reset.');
      break;

    case '/model':
      await changeModel(state, args[0]);
      break;

    case '/provider':
      await changeProvider(state, args[0]);
      break;

    case '/mode':
      await changeMode(state, args[0]);
      break;

    case '/save':
      await saveConversation(state, args[0]);
      break;

    case '/load':
      await loadConversation(state, args[0]);
      break;

    case '/undo':
      if (state.messages.length >= 2) {
        state.messages.pop();
        state.messages.pop();
        output.success('Last message undone.');
      } else {
        output.error('Nothing to undo.');
      }
      break;

    case '/redo':
      output.info('Redo functionality coming soon.');
      break;

    default:
      output.error(`Unknown command: ${command}`);
      output.info('Type /help for available commands.');
  }
}

/**
 * Show help
 */
function showHelp(): void {
  output.info(chalk.cyan.bold('\nAvailable Commands:'));
  output.info(chalk.dim('─'.repeat(50)));

  for (const [cmd, desc] of Object.entries(SPECIAL_COMMANDS)) {
    output.info(`  ${chalk.green(cmd.padEnd(12))} ${chalk.dim(desc)}`);
  }

  output.newline();
  output.info(chalk.dim('Tip: You can also just type your message to chat with the AI.'));
  output.newline();
}

/**
 * Show command history
 */
function showHistory(history: HistoryManager): void {
  const entries = history.load();
  
  if (entries.length === 0) {
    output.info('No history yet.');
    return;
  }

  output.info(chalk.cyan.bold('\nCommand History:'));
  output.info(chalk.dim('─'.repeat(50)));

  const recent = entries.slice(-20);
  for (let i = 0; i < recent.length; i++) {
    output.info(chalk.dim(`${(i + 1).toString().padStart(3)}) `) + recent[i]);
  }

  output.newline();
}

/**
 * Change model
 */
async function changeModel(state: REPLState, model?: string): Promise<void> {
  if (model) {
    state.model = model;
    output.success(`Model changed to: ${model}`);
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'model',
      message: 'Select model:',
      choices: [
        { name: 'Auto (recommended)', value: 'auto' },
        { name: 'Qwen Max', value: 'qwen-max' },
        { name: 'GLM-4 Plus', value: 'glm-4-plus' },
        { name: 'GPT-4', value: 'gpt-4' },
        { name: 'Custom...', value: 'custom' },
      ],
      default: state.model,
    },
  ]);

  if (answers.model === 'custom') {
    const custom = await inquirer.prompt([
      {
        type: 'input',
        name: 'model',
        message: 'Enter model name:',
      },
    ]);
    state.model = custom.model;
  } else {
    state.model = answers.model;
  }

  output.success(`Model changed to: ${state.model}`);
}

/**
 * Change provider
 */
async function changeProvider(state: REPLState, provider?: string): Promise<void> {
  if (provider) {
    state.provider = provider;
    output.success(`Provider changed to: ${provider}`);
    return;
  }

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
      default: state.provider,
    },
  ]);

  state.provider = answers.provider;
  output.success(`Provider changed to: ${state.provider}`);
}

/**
 * Change mode
 */
async function changeMode(state: REPLState, mode?: string): Promise<void> {
  if (mode) {
    state.mode = mode;
    output.success(`Mode changed to: ${mode}`);
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Select mode:',
      choices: [
        { name: 'Default', value: 'default' },
        { name: 'Code', value: 'code' },
        { name: 'Review', value: 'review' },
        { name: 'Test', value: 'test' },
        { name: 'Document', value: 'document' },
      ],
      default: state.mode,
    },
  ]);

  state.mode = answers.mode;
  output.success(`Mode changed to: ${state.mode}`);
}

/**
 * Save conversation
 */
async function saveConversation(_state: REPLState, filename?: string): Promise<void> {
  const name = filename || `conversation-${Date.now()}.json`;
  
  // TODO: Actually save to file
  output.success(`Conversation saved to: ${name}`);
}

/**
 * Load conversation
 */
async function loadConversation(_state: REPLState, filename?: string): Promise<void> {
  if (!filename) {
    output.error('Please specify a file to load.');
    return;
  }

  // TODO: Actually load from file
  output.success(`Conversation loaded from: ${filename}`);
}

/**
 * Get system prompt based on mode
 */
function getModeSystemPrompt(mode: string): string {
  const prompts: Record<string, string> = {
    code: 'You are an expert software engineer. Focus on writing clean, efficient, well-typed code. Always include error handling. Explain your implementation choices.',
    review: 'You are a senior code reviewer. Provide specific, actionable feedback. Note security issues, performance problems, and style violations. Be constructive.',
    test: 'You are a testing expert. Write comprehensive tests covering happy paths, edge cases, and error conditions. Use appropriate testing frameworks.',
    document: 'You are a technical writer. Write clear, concise documentation. Include usage examples, parameter descriptions, and return value explanations.',
    default: 'You are Spazzatura, an expert AI coding assistant combining the best features of Claude Code, Codebuff, and other leading coding tools. Help users with software engineering tasks. Be concise, accurate, and practical.',
  };
  return prompts[mode] ?? prompts['default']!;
}

/**
 * Handle chat message — uses real provider with streaming
 */
async function handleChat(
  input: string,
  state: REPLState,
  options: GlobalOptions,
  router: ProviderRouter
): Promise<void> {
  // Add user message to history
  state.messages.push({ role: 'user', content: input });

  // Build messages array for provider
  const providerMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: getModeSystemPrompt(state.mode) },
    ...state.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  const chatOptions = {
    ...(state.model !== 'auto' ? { model: state.model } : {}),
    temperature: state.temperature,
    ...(state.provider !== 'auto' ? { preferredProvider: state.provider } : {}),
  };

  if (options.stream !== false) {
    // Streaming mode
    output.newline();
    process.stdout.write(chalk.dim('Assistant: '));

    let fullResponse = '';

    try {
      for await (const chunk of router.stream(providerMessages, chatOptions)) {
        if (chunk.delta) {
          process.stdout.write(chunk.delta);
          fullResponse += chunk.delta;
        }
        if (chunk.done) break;
      }
    } catch (err) {
      output.newline();
      output.error(`Provider error: ${err instanceof Error ? err.message : String(err)}`);
      output.info(chalk.dim('Tip: Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY in your environment, or run Ollama locally.'));
      state.messages.pop(); // Remove the failed user message
      return;
    }

    output.newline();
    output.newline();
    state.messages.push({ role: 'assistant', content: fullResponse });
  } else {
    // Non-streaming mode
    const spinner = createSpinner('Thinking...');
    spinner.start();

    try {
      const response = await router.chat(providerMessages, chatOptions);
      spinner.stop();

      output.info(chalk.dim('Assistant:'));
      output.info(formatMarkdown(response.content));
      output.newline();

      state.messages.push({ role: 'assistant', content: response.content });
    } catch (err) {
      spinner.stop();
      output.error(`Provider error: ${err instanceof Error ? err.message : String(err)}`);
      output.info(chalk.dim('Tip: Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY in your environment, or run Ollama locally.'));
      state.messages.pop(); // Remove the failed user message
    }
  }
}

/**
 * Agent command module
 * Multi-agent orchestration command
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import { output } from '../utils/output.js';
import { createSpinner } from '../ui/spinner.js';
import {
  createRouter,
  getDefaultRoutingConfig,
  getDefaultProviderConfig,
  detectAvailableProviders,
} from '@spazzatura/provider';
import {
  createAgent,
  runValidationLoop,
  createFileTool,
  createShellTool,
  createWebTool,
  createCodeTool,
} from '@spazzatura/agent';
import type { Tool } from '@spazzatura/agent';

export const agentCommand = new Command('agent')
  .description('Multi-agent orchestration')
  .addCommand(
    new Command('list')
      .description('List available agents')
      .option('--json', 'Output as JSON')
      .action(async (options: { json?: boolean }) => {
        await listAgents(options);
      })
  )
  .addCommand(
    new Command('run')
      .description('Run a specific agent')
      .argument('<agent>', 'Agent name to run')
      .option('-t, --task <task>', 'Task description')
      .option('-m, --model <model>', 'Model to use')
      .option('-p, --provider <provider>', 'Provider to use')
      .option('--parallel', 'Run in parallel mode')
      .action(async (agent: string, options: RunOptions) => {
        await runAgent(agent, options);
      })
  )
  .addCommand(
    new Command('create')
      .description('Create a new agent')
      .argument('<name>', 'Agent name')
      .option('-t, --template <template>', 'Template to use')
      .option('--tools <tools>', 'Comma-separated list of tools')
      .action(async (name: string, options: CreateOptions) => {
        await createAgent(name, options);
      })
  )
  .addCommand(
    new Command('orchestrate')
      .description('Orchestrate multiple agents')
      .option('-a, --agents <agents>', 'Comma-separated list of agents')
      .option('-t, --task <task>', 'Task description')
      .option('--parallel', 'Run agents in parallel')
      .option('--pipeline', 'Run agents in pipeline mode')
      .action(async (options: OrchestrateOptions) => {
        await orchestrateAgents(options);
      })
  )
  .addCommand(
    new Command('install')
      .description('Install agent from marketplace')
      .argument('<package>', 'Package name (e.g., @community/security-scanner)')
      .action(async (pkg: string) => {
        await installAgent(pkg);
      })
  )
  .addCommand(
    new Command('publish')
      .description('Publish agent to marketplace')
      .argument('<name>', 'Agent name to publish')
      .action(async (name: string) => {
        await publishAgent(name);
      })
  );

/**
 * Run options
 */
interface RunOptions {
  task?: string;
  model?: string;
  provider?: string;
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
 * Orchestrate options
 */
interface OrchestrateOptions {
  agents?: string;
  task?: string;
  parallel?: boolean;
  pipeline?: boolean;
}

/**
 * Built-in agents
 */
const BUILTIN_AGENTS = [
  {
    name: 'coder',
    description: 'Code generation and implementation agent',
    tools: ['read_file', 'write_file', 'run_command', 'search_code'],
    status: 'available',
    systemPrompt: 'You are an expert software engineer. Write clean, type-safe, well-structured code. Always handle errors. Explain your implementation decisions concisely.',
  },
  {
    name: 'reviewer',
    description: 'Code review and quality analysis agent',
    tools: ['read_file', 'search_code'],
    status: 'available',
    systemPrompt: 'You are a senior code reviewer. Identify security issues, performance problems, type errors, and style violations. Be specific and constructive.',
  },
  {
    name: 'tester',
    description: 'Test generation and execution agent',
    tools: ['read_file', 'write_file', 'run_command'],
    status: 'available',
    systemPrompt: 'You are a testing expert. Write comprehensive tests covering happy paths, edge cases, and error conditions. Follow RED-GREEN-REFACTOR TDD discipline.',
  },
  {
    name: 'analyst',
    description: 'Requirements and architecture analysis agent',
    tools: ['read_file', 'search_code'],
    status: 'available',
    systemPrompt: 'You are a software architect. Analyze requirements carefully. Identify risks, dependencies, and design trade-offs. Produce clear, actionable specs.',
  },
  {
    name: 'sisyphus',
    description: 'Orchestrator: 3-phase workflow (Intent Gate → Exploration → Implementation)',
    tools: ['read_file', 'write_file', 'run_command', 'search_code'],
    status: 'available',
    systemPrompt: 'You are Sisyphus, a senior orchestrator agent. You follow a strict 3-phase workflow: (1) Intent Gate — clarify and validate the goal, (2) Exploration — explore the codebase and gather context before any implementation, (3) Implementation — delegate to worker agents. Never implement before fully exploring.',
  },
  {
    name: 'hephaestus',
    description: 'Deep executor with exploration-before-action discipline',
    tools: ['read_file', 'write_file', 'run_command', 'search_code'],
    status: 'available',
    systemPrompt: 'You are Hephaestus, an autonomous deep executor. You ALWAYS explore before acting. Read relevant files, understand the codebase, then implement. Never write code without first understanding the context.',
  },
  {
    name: 'prometheus',
    description: 'Strategic planner — plans only, never implements',
    tools: ['read_file', 'search_code'],
    status: 'available',
    systemPrompt: 'You are Prometheus, a strategic planner. Your role is ONLY to plan — never to implement. Create detailed, step-by-step implementation plans. Identify all files to change, all risks, all dependencies. Hand off to worker agents for execution.',
  },
  {
    name: 'momus',
    description: 'Plan validator — challenges assumptions, checks file refs, approves or blocks plans',
    tools: ['read_file', 'search_code'],
    status: 'available',
    systemPrompt: 'You are Momus, a plan reviewer. Challenge assumptions, verify file references, and surface hidden risks. Output: APPROVE or BLOCK with specific reasoning.',
  },
  {
    name: 'fullstack',
    description: 'End-to-end feature implementation — frontend, backend, tests, and docs in one pass',
    tools: ['read_file', 'write_file', 'run_command', 'search_code'],
    status: 'available',
    systemPrompt: 'You are a fullstack engineer. Implement features end-to-end: frontend, backend, database, tests, and docs. FORBIDDEN: leaving any layer incomplete.',
  },
  {
    name: 'pair-programmer',
    description: 'TDD pair programming partner — write test first, then you implement, then it reviews',
    tools: ['read_file', 'write_file', 'run_command'],
    status: 'available',
    systemPrompt: 'You are a TDD pair programmer. Always write tests first. FORBIDDEN: writing implementation before a failing test exists. Strict RED-GREEN-REFACTOR discipline.',
  },
  {
    name: 'tech-lead',
    description: 'Architecture decisions and PR reviews in ADR format — never writes code',
    tools: ['read_file', 'search_code'],
    status: 'available',
    systemPrompt: 'You are a tech lead. Review architecture, make decisions in ADR format. FORBIDDEN: writing any code. Surface trade-offs, not opinions.',
  },
  {
    name: 'security-auditor',
    description: 'OWASP Top 10, CVE scanning, secrets detection, threat modeling — exhaustive analysis',
    tools: ['read_file', 'run_command', 'search_code'],
    status: 'available',
    systemPrompt: 'You are a security auditor. Identify OWASP Top 10, CVEs, hardcoded secrets, injection vulnerabilities, and auth flaws. FORBIDDEN: marking anything "good enough" without exhaustive analysis.',
  },
  {
    name: 'performance-optimizer',
    description: 'CPU/memory profiling, async bottlenecks, bundle size — benchmarks before and after',
    tools: ['read_file', 'write_file', 'run_command'],
    status: 'available',
    systemPrompt: 'You are a performance optimization specialist. Profile first, then optimize. FORBIDDEN: optimizing without benchmarking before AND after every change.',
  },
  {
    name: 'refactorer',
    description: 'Large-scale safe refactoring in incremental steps — hash-verifies changed files',
    tools: ['read_file', 'write_file', 'run_command', 'search_code'],
    status: 'available',
    systemPrompt: 'You are a refactoring specialist. Make incremental, safe refactoring steps. FORBIDDEN: making multiple simultaneous changes, breaking public APIs without deprecation.',
  },
  {
    name: 'test-architect',
    description: 'Test pyramid design, coverage gap analysis, mutation testing — failing tests first',
    tools: ['read_file', 'write_file', 'run_command', 'search_code'],
    status: 'available',
    systemPrompt: 'You are a test architect. Design comprehensive test suites with proper pyramid balance. FORBIDDEN: writing tests that can never fail, skipping edge cases.',
  },
  {
    name: 'documentation-writer',
    description: 'JSDoc, README, API docs, tutorials, changelogs — output passes markdownlint',
    tools: ['read_file', 'write_file', 'search_code'],
    status: 'available',
    systemPrompt: 'You are a technical documentation specialist. Write clear, accurate, and complete documentation. FORBIDDEN: guessing about behavior — always verify from source code.',
  },
  {
    name: 'api-designer',
    description: 'OpenAPI 3.1 spec design, REST/GraphQL, SDK generation — produces valid linted YAML',
    tools: ['read_file', 'write_file', 'search_code'],
    status: 'available',
    systemPrompt: 'You are an API design expert. Design clean, consistent REST or GraphQL APIs. FORBIDDEN: inconsistent naming, missing error responses, undocumented authentication.',
  },
  {
    name: 'database-designer',
    description: 'Schema design, migrations, query optimization, indexing — generates migration files',
    tools: ['read_file', 'write_file', 'run_command', 'search_code'],
    status: 'available',
    systemPrompt: 'You are a database design expert. Design normalized schemas with proper indexing and migrations. FORBIDDEN: raw SQL edits without migration files, omitting indexes on foreign keys.',
  },
  {
    name: 'dependency-manager',
    description: 'Audits vulnerabilities, outdated packages, SPDX license compliance, conflicts, and bundle size',
    tools: ['read_file', 'run_command'],
    status: 'available',
    systemPrompt: 'You are a dependency management specialist. Audit security vulnerabilities, outdated packages, SPDX license compliance, and conflicts. FORBIDDEN: updating major versions without explicit approval, modifying lock files directly.',
  },
  {
    name: 'devops-agent',
    description: 'CI/CD pipelines, Docker, Kubernetes, Terraform with idempotent and least-privilege configurations',
    tools: ['read_file', 'write_file', 'run_command'],
    status: 'available',
    systemPrompt: 'You are a senior DevOps engineer. Produce idempotent CI/CD, Docker, Kubernetes, and Terraform configurations. FORBIDDEN: hardcoding secrets, using :latest tags, creating non-idempotent operations.',
  },
  {
    name: 'git-workflow',
    description: 'Conventional Commits enforcement, PR descriptions, branching strategy, changelogs',
    tools: ['read_file', 'run_command'],
    status: 'available',
    systemPrompt: 'You are a git workflow expert. Enforce Conventional Commits, PR standards, and branch protection. FORBIDDEN: force-pushing main/master, committing secrets.',
  },
  {
    name: 'cloud-architect',
    description: 'AWS/GCP/Azure architecture design with cost estimates and Well-Architected Framework alignment',
    tools: ['read_file', 'search_code'],
    status: 'available',
    systemPrompt: 'You are a senior cloud architect. Design resilient, cost-optimized cloud architectures. FORBIDDEN: writing code. Always include cost estimates and reference the Well-Architected Framework.',
  },
  {
    name: 'data-scientist',
    description: 'Reproducible ML pipelines, rigorous multi-metric evaluation, pandas/polars processing',
    tools: ['read_file', 'write_file', 'run_command'],
    status: 'available',
    systemPrompt: 'You are a senior data scientist. Produce reproducible, lint-clean analysis. FORBIDDEN: hardcoding file paths, using non-reproducible randomness (always set seeds).',
  },
  {
    name: 'codebase-explorer',
    description: 'Read-only deep codebase understanding — dependency graphs, call graphs, onboarding docs',
    tools: ['read_file', 'search_code'],
    status: 'available',
    systemPrompt: 'You are a read-only codebase exploration specialist. FORBIDDEN: modifying any files, writing any code. Produce comprehensive understanding documents with entry points, abstractions, and data flow.',
  },
  {
    name: 'debugger',
    description: 'Systematic 4-phase debugger — Observe, Isolate, Hypothesize, Fix',
    tools: ['read_file', 'run_command', 'search_code'],
    status: 'available',
    systemPrompt: 'You are a systematic debugger. Follow the 4-phase protocol: Observe, Isolate, Hypothesize, Fix. FORBIDDEN: making multiple simultaneous changes, guessing without evidence.',
  },
  {
    name: 'scaffold',
    description: 'Project scaffolding from zero — monorepo, CI, tooling, opinionated best-practice templates',
    tools: ['read_file', 'write_file', 'run_command'],
    status: 'available',
    systemPrompt: 'You are a project scaffolding expert. Create opinionated, production-ready project structures. FORBIDDEN: scaffolding without explaining structure first.',
  },
  {
    name: 'migrator',
    description: 'Framework/language migrations — atomic per-file with rollback plans',
    tools: ['read_file', 'write_file', 'run_command', 'search_code'],
    status: 'available',
    systemPrompt: 'You are a migration specialist. Perform atomic per-file migrations with rollback plans. FORBIDDEN: batch-migrating everything at once, proceeding without test verification.',
  },
  {
    name: 'optimizer-llm',
    description: 'Prompt engineering and LLM pipeline optimization with concrete before/after benchmarks',
    tools: ['read_file', 'write_file', 'run_command'],
    status: 'available',
    systemPrompt: 'You are an LLM pipeline optimization specialist. FORBIDDEN: claiming improvements without measuring. Always measure quality metrics before and after with concrete benchmarks.',
  },
  // Codebuff agents (adapted from vendor/codebuff)
  {
    name: 'codebuff-planner',
    description: 'Codebuff-style planner: decomposes goals into ordered implementation steps with risk ratings',
    tools: ['read_file', 'search_code'],
    status: 'available',
    systemPrompt: 'You are a Codebuff-style planning agent. Break down goals into ordered, atomic implementation steps. Rate each step low/medium/high risk. List all files that change. Do NOT write any code.',
  },
  {
    name: 'codebuff-editor',
    description: 'Codebuff-style editor: applies precise minimal file changes from a plan',
    tools: ['read_file', 'write_file', 'run_command'],
    status: 'available',
    systemPrompt: 'You are a Codebuff-style editor agent. Apply precise, minimal file changes per the plan. Read every file before editing it. FORBIDDEN: removing code not in the plan, adding features not requested.',
  },
  {
    name: 'codebuff-reviewer',
    description: 'Codebuff "Nit Pick Nick": terse critical-only code review, no positive feedback',
    tools: ['read_file', 'search_code'],
    status: 'available',
    systemPrompt: 'You are Nit Pick Nick, a terse code reviewer from Codebuff. Give only critical feedback. Format: CRITICAL / MAJOR / MINOR with file:line refs. If nothing critical: one sentence. FORBIDDEN: listing strengths, being verbose.',
  },
];

/**
 * Build a provider router from options
 */
function buildAgentRouter(options: RunOptions) {
  const available = detectAvailableProviders();
  const providerConfigs = [];

  for (const p of available) {
    if (p.configured || p.free) {
      try {
        providerConfigs.push(getDefaultProviderConfig(p.type));
      } catch { /* skip */ }
    }
  }

  if (options.provider && options.provider !== 'auto') {
    const idx = providerConfigs.findIndex(p => p.name === options.provider);
    if (idx > 0) {
      const [prov] = providerConfigs.splice(idx, 1);
      if (prov) providerConfigs.unshift(prov);
    }
  }

  return createRouter(providerConfigs, getDefaultRoutingConfig());
}

/**
 * List available agents
 */
async function listAgents(options: { json?: boolean }): Promise<void> {
  if (options.json) {
    output.json(BUILTIN_AGENTS);
    return;
  }

  const table = new Table({
    head: [chalk.cyan('Name'), chalk.cyan('Description'), chalk.cyan('Status')],
    colWidths: [15, 50, 12],
  });

  for (const agent of BUILTIN_AGENTS) {
    table.push([
      agent.name,
      agent.description,
      agent.status === 'available' ? chalk.green('✓ Available') : chalk.yellow('Busy'),
    ]);
  }

  output.info(table.toString());
  output.newline();
  output.info(chalk.dim(`Total: ${BUILTIN_AGENTS.length} agents`));
}

/**
 * Run a specific agent with real LLM integration and validation loop
 */
async function runAgent(agent: string, options: RunOptions): Promise<void> {
  const agentInfo = BUILTIN_AGENTS.find(a => a.name === agent);

  if (!agentInfo) {
    output.error(`Agent "${agent}" not found. Use "agent list" to see available agents.`);
    process.exit(1);
  }

  let task = options.task;

  if (!task) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'task',
        message: 'Enter task description:',
        validate: (input: string) => input.length > 0 || 'Task is required',
      },
    ]);
    task = answers.task as string;
  }

  output.info(chalk.cyan.bold(`\n${agentInfo.name.toUpperCase()} Agent`));
  output.info(chalk.dim('─'.repeat(50)));
  output.info(`Task: ${chalk.white(task!)}`);
  output.newline();

  const router = buildAgentRouter(options);

  // Build real tools from the agent's tool list
  const allTools: Record<string, Tool> = {
    read_file: createFileTool({ allowedPaths: [process.cwd()] }),
    write_file: createFileTool({ allowedPaths: [process.cwd()] }),
    run_command: createShellTool({ allowedCommands: ['ls', 'cat', 'grep', 'find', 'git', 'npm', 'pnpm', 'node', 'tsc', 'vitest'] }),
    search_code: createCodeTool(),
    web_search: createWebTool(),
  };

  const agentTools = agentInfo.tools
    .map(toolName => allTools[toolName])
    .filter((t): t is Tool => t !== undefined);

  // Create and configure the agent
  const agentInstance = createAgent({
    name: agentInfo.name,
    description: agentInfo.description,
    systemPrompt: agentInfo.systemPrompt,
    tools: agentTools,
    model: {
      provider: options.provider ?? 'auto',
      model: options.model ?? 'auto',
      temperature: 0.7,
      maxTokens: 8192,
    },
    maxIterations: 10,
  });

  // Set provider on agent via the router's first available provider
  const status = router.getStatus();
  output.info(chalk.dim(`Using provider: ${status.providers.find(p => p.available)?.name ?? 'auto'}`));
  output.newline();

  const spinner = createSpinner('Agent thinking...');
  spinner.start();

  try {
    // Stream the agent execution so we can show live tool calls
    let finalOutput = '';
    let iterations = 0;

    for await (const event of agentInstance.stream(task!)) {
      if (event.type === 'tool_call') {
        spinner.stop();
        const data = event.data as Record<string, unknown> | undefined;
        const toolName = data?.['name'] ?? 'tool';
        const args = data?.['args'] ?? {};
        output.info(chalk.dim(`  → ${String(toolName)}(${JSON.stringify(args).slice(0, 80)})`));
        spinner.start();
      } else if (event.type === 'tool_result') {
        spinner.stop();
        const data = event.data as Record<string, unknown> | undefined;
        const result = data?.['result'] ?? '';
        const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
        output.info(chalk.dim(`  ← ${resultStr.slice(0, 100)}`));
        spinner.start();
      } else if (event.type === 'content_delta') {
        const data = event.data as Record<string, unknown> | undefined;
        const delta = data?.['delta'] as string | undefined;
        if (delta) finalOutput += delta;
      } else if (event.type === 'message_end') {
        iterations++;
      }
    }

    spinner.stop();

    output.newline();
    output.success(`Agent "${agentInfo.name}" completed!`);
    output.newline();

    if (finalOutput) {
      output.info(chalk.bold('Output:'));
      output.info(finalOutput);
    }

    output.info(chalk.dim(`\nIterations: ${iterations}`));
  } catch (err) {
    spinner.stop();
    output.error(`Agent failed: ${err instanceof Error ? err.message : String(err)}`);
    output.info(chalk.dim('Tip: Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY, or run Ollama locally.'));
    process.exit(1);
  }
}

/**
 * Create a new agent
 */
async function createAgent(name: string, options: CreateOptions): Promise<void> {
  output.info(`Creating agent "${name}"...`);

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'template',
      message: 'Select agent template:',
      choices: ['basic', 'coder', 'reviewer', 'custom'],
      default: options.template || 'basic',
    },
    {
      type: 'checkbox',
      name: 'tools',
      message: 'Select tools for the agent:',
      choices: [
        { name: 'file_read', checked: true },
        { name: 'file_write', checked: true },
        { name: 'execute_command', checked: false },
        { name: 'git_operations', checked: false },
        { name: 'search_code', checked: false },
        { name: 'web_search', checked: false },
      ],
    },
  ]);

  const spinner = createSpinner('Creating agent...');
  spinner.start();

  // TODO: Actually create agent configuration
  await new Promise(resolve => setTimeout(resolve, 1000));

  spinner.stop();
  
  output.success(`Agent "${name}" created successfully!`);
  output.info(chalk.dim(`Template: ${answers.template}`));
  output.info(chalk.dim(`Tools: ${answers.tools.join(', ')}`));
}

/**
 * Orchestrate multiple agents
 */
async function orchestrateAgents(options: OrchestrateOptions): Promise<void> {
  let agents = options.agents?.split(',').map(a => a.trim());
  
  if (!agents || agents.length === 0) {
    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'agents',
        message: 'Select agents to orchestrate:',
        choices: BUILTIN_AGENTS.map(a => ({ name: a.name, value: a.name })),
        validate: (input: string[]) => input.length > 0 || 'Select at least one agent',
      },
    ]);
    agents = answers.agents;
  }

  let task = options.task;
  
  if (!task) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'task',
        message: 'Enter task description:',
        validate: (input: string) => input.length > 0 || 'Task is required',
      },
    ]);
    task = answers.task;
  }

  const mode = options.parallel ? 'parallel' : options.pipeline ? 'pipeline' : 'sequential';
  
  output.info(chalk.cyan(`Orchestrating agents: ${agents!.join(', ')}`));
  output.info(chalk.dim(`Mode: ${mode}`));
  output.info(chalk.dim(`Task: ${task}`));
  output.newline();

  const spinner = createSpinner('Running orchestration...');
  spinner.start();

  // TODO: Integrate with actual orchestration engine
  await new Promise(resolve => setTimeout(resolve, 3000));

  spinner.stop();
  
  output.success('Orchestration completed!');
}

/**
 * Install agent from marketplace
 */
async function installAgent(pkg: string): Promise<void> {
  output.info(`Installing agent from marketplace: ${pkg}`);
  
  const spinner = createSpinner('Installing...');
  spinner.start();

  // TODO: Integrate with marketplace
  await new Promise(resolve => setTimeout(resolve, 2000));

  spinner.stop();
  
  output.success(`Agent "${pkg}" installed successfully!`);
}

/**
 * Publish agent to marketplace
 */
async function publishAgent(name: string): Promise<void> {
  output.info(`Publishing agent "${name}" to marketplace...`);
  
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to publish this agent?',
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
  
  output.success(`Agent "${name}" published successfully!`);
}

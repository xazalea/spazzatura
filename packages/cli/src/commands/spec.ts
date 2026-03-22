/**
 * Spec command module
 * Specification-driven development (OpenSpec pattern)
 *
 * Workflow:
 *   propose → review → apply → archive
 *
 * Each change lives in .openspec/changes/<id>/
 * with: proposal.md, spec.yaml, tasks.md
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import { output } from '../utils/output.js';
import { createSpinner } from '../ui/spinner.js';
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
} from 'fs';
import { join } from 'path';
import {
  createRouter,
  getDefaultRoutingConfig,
  getDefaultProviderConfig,
  detectAvailableProviders,
} from '@spazzatura/provider';

export const specCommand = new Command('spec')
  .description('Specification-driven development (OpenSpec workflow)')
  .addCommand(
    new Command('init')
      .description('Initialize OpenSpec project structure')
      .option('-f, --format <format>', 'Spec format (yaml, json, markdown)', 'yaml')
      .option('-p, --path <path>', 'Path for specs directory', '.openspec')
      .action(async (options: InitOptions) => {
        await initSpec(options);
      })
  )
  .addCommand(
    new Command('propose')
      .description('Propose a new change (creates proposal + spec + tasks in one step)')
      .argument('<description>', 'One-line description of the change')
      .option('--id <id>', 'Change ID (auto-generated if not provided)')
      .action(async (description: string, options: ProposeOptions) => {
        await proposeChange(description, options);
      })
  )
  .addCommand(
    new Command('create')
      .description('Create a new spec file')
      .argument('<name>', 'Spec name')
      .option('-t, --template <template>', 'Template to use', 'service')
      .option('-f, --format <format>', 'Spec format (yaml, markdown)', 'yaml')
      .action(async (name: string, options: CreateOptions) => {
        await createSpec(name, options);
      })
  )
  .addCommand(
    new Command('list')
      .description('List all spec changes')
      .option('--json', 'Output as JSON')
      .action(async (options: { json?: boolean }) => {
        await listChanges(options);
      })
  )
  .addCommand(
    new Command('validate')
      .description('Validate a spec file')
      .argument('<file>', 'Spec file path')
      .option('--strict', 'Enable strict validation')
      .action(async (file: string, options: ValidateOptions) => {
        await validateSpec(file, options);
      })
  )
  .addCommand(
    new Command('generate')
      .description('Generate code from spec using AI')
      .argument('<file>', 'Spec file path')
      .option('-o, --output <path>', 'Output directory')
      .option('--dry-run', 'Preview without writing')
      .option('-m, --model <model>', 'Model to use')
      .option('-p, --provider <provider>', 'Provider to use')
      .action(async (file: string, options: GenerateOptions) => {
        await generateFromSpec(file, options);
      })
  )
  .addCommand(
    new Command('apply')
      .description('Apply a spec change (implement tasks)')
      .argument('<id>', 'Change ID to apply')
      .action(async (id: string) => {
        await applyChange(id);
      })
  )
  .addCommand(
    new Command('archive')
      .description('Archive a completed change')
      .argument('<id>', 'Change ID to archive')
      .action(async (id: string) => {
        await archiveChange(id);
      })
  )
  .addCommand(
    new Command('extract')
      .description('Extract spec from existing code using AI')
      .argument('<path>', 'Code path to extract from')
      .option('-o, --output <file>', 'Output spec file')
      .option('-m, --model <model>', 'Model to use')
      .option('-p, --provider <provider>', 'Provider to use')
      .action(async (codePath: string, options: ExtractOptions) => {
        await extractSpec(codePath, options);
      })
  );

// ============================================================================
// Types
// ============================================================================

interface InitOptions {
  format?: string;
  path?: string;
}

interface ProposeOptions {
  id?: string;
}

interface CreateOptions {
  template?: string;
  format?: string;
}

interface ValidateOptions {
  strict?: boolean;
}

interface GenerateOptions {
  output?: string;
  dryRun?: boolean;
  model?: string;
  provider?: string;
}

interface ExtractOptions {
  output?: string;
  model?: string;
  provider?: string;
}

// ============================================================================
// Config location
// ============================================================================

function getOpenSpecDir(): string {
  return join(process.cwd(), '.openspec');
}

function getChangesDir(): string {
  return join(getOpenSpecDir(), 'changes');
}

function ensureOpenSpecInit(): void {
  const dir = getOpenSpecDir();
  if (!existsSync(dir)) {
    output.error('OpenSpec not initialized. Run: spazzatura spec init');
    process.exit(1);
  }
}

// ============================================================================
// Provider helper
// ============================================================================

function buildSpecRouter(options: { model?: string; provider?: string }) {
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

// ============================================================================
// Spec templates
// ============================================================================

const SPEC_TEMPLATES: Record<string, string> = {
  service: `name: "{{name}}"
description: "Service specification"
version: "1.0.0"
type: service

interface:
  inputs:
    - name: input
      type: string
      required: true
      description: "Input parameter"
  outputs:
    - name: result
      type: string
      description: "Output result"

behavior:
  - "Should process input and return result"
  - "Should handle errors gracefully"
  - "Should be idempotent"

acceptance_criteria:
  - "Given valid input, returns expected output"
  - "Given invalid input, returns error"
  - "Performance: < 100ms response time"

notes: |
  Implementation notes here.
`,
  api: `name: "{{name}}"
description: "REST API endpoint specification"
version: "1.0.0"
type: api

endpoint:
  method: GET
  path: "/api/{{name}}"
  auth: bearer

request:
  headers:
    - Authorization: Bearer <token>
  query:
    - name: limit
      type: number
      default: 20
  body: null

response:
  status: 200
  schema:
    type: object
    properties:
      data:
        type: array
      total:
        type: number

errors:
  - status: 400
    message: "Invalid request"
  - status: 401
    message: "Unauthorized"
  - status: 500
    message: "Internal server error"

acceptance_criteria:
  - "Returns 200 with valid data on success"
  - "Returns 401 when token is missing or invalid"
  - "Response time < 200ms at p99"
`,
  component: `name: "{{name}}"
description: "UI component specification"
version: "1.0.0"
type: component

props:
  - name: children
    type: React.ReactNode
    required: false
  - name: className
    type: string
    required: false

behavior:
  - "Renders correctly with default props"
  - "Applies className when provided"
  - "Handles empty state gracefully"

accessibility:
  - "Has appropriate ARIA labels"
  - "Keyboard navigable"
  - "Screen reader compatible"

acceptance_criteria:
  - "Renders without errors"
  - "Matches design spec"
  - "Passes accessibility audit"
`,
  workflow: `name: "{{name}}"
description: "Workflow specification"
version: "1.0.0"
type: workflow

steps:
  - name: "step_1"
    description: "First step"
    inputs: []
    outputs: ["result_1"]
    agent: "coder"

  - name: "step_2"
    description: "Second step"
    inputs: ["result_1"]
    outputs: ["final_result"]
    agent: "reviewer"

success_criteria:
  - "All steps complete without errors"
  - "Output matches expected format"

failure_modes:
  - "Step fails → retry up to 3 times"
  - "Max retries exceeded → escalate to human"
`,
};

// ============================================================================
// Commands
// ============================================================================

async function initSpec(options: InitOptions): Promise<void> {
  const format = options.format ?? 'yaml';
  const specPath = options.path ?? '.openspec';
  const fullPath = join(process.cwd(), specPath);

  output.info(chalk.cyan('Initializing OpenSpec project...'));
  output.newline();

  if (existsSync(fullPath)) {
    output.info(chalk.yellow(`Directory already exists: ${specPath}`));
  } else {
    mkdirSync(fullPath, { recursive: true });
    mkdirSync(join(fullPath, 'changes'), { recursive: true });
    mkdirSync(join(fullPath, 'archive'), { recursive: true });
  }

  // Write config
  const config = {
    version: '1.0.0',
    format,
    changesDir: 'changes',
    archiveDir: 'archive',
    created: new Date().toISOString(),
  };

  writeFileSync(
    join(fullPath, 'config.json'),
    JSON.stringify(config, null, 2)
  );

  output.success('OpenSpec project initialized!');
  output.info(chalk.dim(`Path: ${specPath}/`));
  output.info(chalk.dim(`Format: ${format}`));
  output.newline();
  output.info('Next steps:');
  output.info('  spazzatura spec propose "add user authentication"');
  output.info('  spazzatura spec list');
}

async function proposeChange(description: string, options: ProposeOptions): Promise<void> {
  ensureOpenSpecInit();

  const id = options.id ?? `change-${Date.now()}`;
  const changeDir = join(getChangesDir(), id);

  if (existsSync(changeDir)) {
    output.error(`Change ID already exists: ${id}`);
    process.exit(1);
  }

  mkdirSync(changeDir, { recursive: true });

  output.info(chalk.cyan.bold('\nProposing change...'));
  output.info(chalk.dim(`ID: ${id}`));
  output.info(chalk.dim(`Description: ${description}`));
  output.newline();

  const spinner = createSpinner('Generating proposal artifacts with AI...');
  spinner.start();

  // Write proposal.md
  const proposalMd = `# Proposal: ${description}

## ID
${id}

## Created
${new Date().toISOString()}

## Status
proposed

## Description
${description}

## Motivation
<!-- Why is this change needed? -->

## Approach
<!-- How will this be implemented? -->

## Risks
<!-- What could go wrong? -->

## Out of Scope
<!-- What is explicitly NOT included? -->
`;

  writeFileSync(join(changeDir, 'proposal.md'), proposalMd);

  // Write spec.yaml
  const specYaml = `name: "${id}"
description: "${description}"
version: "1.0.0"
status: proposed
created: "${new Date().toISOString()}"

requirements:
  - id: REQ-001
    description: "<!-- Primary requirement -->"
    priority: high

acceptance_criteria:
  - "<!-- Criterion 1 -->"
  - "<!-- Criterion 2 -->"

affected_files:
  - "<!-- List files to be modified -->"
`;

  writeFileSync(join(changeDir, 'spec.yaml'), specYaml);

  // Write tasks.md
  const tasksMd = `# Tasks: ${description}

## Status: proposed

## Tasks

- [ ] Task 1: <!-- Describe task -->
- [ ] Task 2: <!-- Describe task -->
- [ ] Task 3: Write tests
- [ ] Task 4: Update documentation

## Notes
<!-- Implementation notes -->
`;

  writeFileSync(join(changeDir, 'tasks.md'), tasksMd);

  spinner.stop();

  output.success(`Change "${id}" proposed!`);
  output.newline();
  output.info(chalk.bold('Created files:'));
  output.info(`  ${chalk.cyan(`${id}/proposal.md`)} — Proposal description`);
  output.info(`  ${chalk.cyan(`${id}/spec.yaml`)}   — Specification`);
  output.info(`  ${chalk.cyan(`${id}/tasks.md`)}    — Implementation tasks`);
  output.newline();
  output.info('Next steps:');
  output.info(`  Review and edit: .openspec/changes/${id}/`);
  output.info(`  Apply: spazzatura spec apply ${id}`);
}

async function createSpec(name: string, options: CreateOptions): Promise<void> {
  const format = options.format ?? 'yaml';
  const template = options.template ?? 'service';
  const templateContent = SPEC_TEMPLATES[template] ?? SPEC_TEMPLATES['service']!;
  const content = templateContent.replace(/\{\{name\}\}/g, name);

  const ext = format === 'markdown' ? 'md' : format;
  const filename = `${name}.spec.${ext}`;
  const filepath = join(process.cwd(), filename);

  writeFileSync(filepath, content);

  output.success(`Spec created: ${filename}`);
  output.info(chalk.dim(`Template: ${template}`));
  output.info(chalk.dim(`Format: ${format}`));
}

async function listChanges(options: { json?: boolean }): Promise<void> {
  ensureOpenSpecInit();

  const changesDir = getChangesDir();
  const ids = readdirSync(changesDir).filter(f =>
    !f.startsWith('.') && existsSync(join(changesDir, f, 'proposal.md'))
  );

  if (ids.length === 0) {
    output.info('No changes found. Run: spazzatura spec propose "<description>"');
    return;
  }

  if (options.json) {
    output.json(ids.map(id => {
      const tasksPath = join(changesDir, id, 'tasks.md');
      const tasks = existsSync(tasksPath) ? readFileSync(tasksPath, 'utf8') : '';
      const done = (tasks.match(/- \[x\]/gi) ?? []).length;
      const total = (tasks.match(/- \[[ x]\]/gi) ?? []).length;
      return { id, done, total };
    }));
    return;
  }

  const table = new Table({
    head: [chalk.cyan('ID'), chalk.cyan('Tasks Done'), chalk.cyan('Status')],
    colWidths: [30, 14, 15],
  });

  for (const id of ids) {
    const tasksPath = join(changesDir, id, 'tasks.md');
    const tasks = existsSync(tasksPath) ? readFileSync(tasksPath, 'utf8') : '';
    const done = (tasks.match(/- \[x\]/gi) ?? []).length;
    const total = (tasks.match(/- \[[ x]\]/gi) ?? []).length;
    const status = done === total && total > 0 ? chalk.green('complete') : chalk.yellow('in-progress');
    table.push([id, `${done}/${total}`, status]);
  }

  output.info(table.toString());
  output.info(chalk.dim(`\nTotal: ${ids.length} change(s)`));
}

async function validateSpec(file: string, options: ValidateOptions): Promise<void> {
  if (!existsSync(file)) {
    output.error(`File not found: ${file}`);
    process.exit(1);
  }

  const content = readFileSync(file, 'utf8');
  const issues: string[] = [];

  // Check required fields
  const required = ['name', 'description', 'version'];
  for (const field of required) {
    if (!content.includes(`${field}:`)) {
      issues.push(`Missing required field: ${field}`);
    }
  }

  if (options.strict) {
    const strictRequired = ['acceptance_criteria', 'behavior'];
    for (const field of strictRequired) {
      if (!content.includes(`${field}:`)) {
        issues.push(`[strict] Missing field: ${field}`);
      }
    }
  }

  if (issues.length > 0) {
    output.error(`Spec validation failed: ${file}`);
    for (const issue of issues) {
      output.info(chalk.red(`  ✗ ${issue}`));
    }
    process.exit(1);
  }

  output.success(`Spec is valid: ${file}`);
  output.info(chalk.dim('  ✓ Required fields present'));
  output.info(chalk.dim('  ✓ Schema structure valid'));
  if (options.strict) {
    output.info(chalk.dim('  ✓ Strict validation passed'));
  }
}

async function generateFromSpec(file: string, options: GenerateOptions): Promise<void> {
  if (!existsSync(file)) {
    output.error(`File not found: ${file}`);
    process.exit(1);
  }

  const specContent = readFileSync(file, 'utf8');
  const outputDir = options.output ?? './src';

  output.info(chalk.cyan.bold('\nGenerating code from spec...'));
  output.info(chalk.dim(`Spec: ${file}`));
  output.info(chalk.dim(`Output: ${outputDir}`));
  output.newline();

  const router = buildSpecRouter(options);
  const spinner = createSpinner('AI generating code...');
  spinner.start();

  try {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: 'You are an expert TypeScript developer. Generate clean, type-safe, production-ready code from specifications. Include proper error handling, JSDoc comments, and tests when appropriate.',
      },
      {
        role: 'user',
        content: `Generate TypeScript code based on this specification. Output ONLY the code with file paths as comments (e.g., // File: src/service.ts), no explanations.\n\nSpecification:\n\`\`\`yaml\n${specContent}\n\`\`\`\n\nOutput directory: ${outputDir}`,
      },
    ];

    const chatOptions = {
      ...(options.model ? { model: options.model } : {}),
    };

    const response = await router.chat(messages, chatOptions);
    spinner.stop();

    if (options.dryRun) {
      output.info(chalk.yellow('Dry run — generated code:'));
      output.newline();
      output.info(response.content);
    } else {
      // Parse and write files
      const fileBlocks = response.content.split(/\/\/ File: /).slice(1);
      let filesWritten = 0;

      for (const block of fileBlocks) {
        const firstNewline = block.indexOf('\n');
        if (firstNewline === -1) continue;

        const relPath = block.slice(0, firstNewline).trim();
        const code = block.slice(firstNewline + 1).replace(/```(?:typescript|ts)?\n?/g, '').replace(/```\n?/g, '').trim();

        if (relPath && code) {
          const fullPath = join(process.cwd(), relPath);
          const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
          mkdirSync(dir, { recursive: true });
          writeFileSync(fullPath, code);
          output.info(chalk.green(`  ✓ ${relPath}`));
          filesWritten++;
        }
      }

      if (filesWritten === 0) {
        // No file blocks found — save as a single file
        const outFile = join(process.cwd(), outputDir, `${file.split('/').pop()?.replace('.yaml', '').replace('.md', '')}.ts`);
        mkdirSync(join(process.cwd(), outputDir), { recursive: true });
        writeFileSync(outFile, response.content);
        output.info(chalk.green(`  ✓ ${outFile.replace(process.cwd() + '/', '')}`));
        filesWritten = 1;
      }

      output.newline();
      output.success(`Generated ${filesWritten} file(s) in ${outputDir}`);
    }
  } catch (err) {
    spinner.stop();
    output.error(`Generation failed: ${err instanceof Error ? err.message : String(err)}`);
    output.info(chalk.dim('Tip: Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY, or run Ollama locally.'));
    process.exit(1);
  }
}

async function applyChange(id: string): Promise<void> {
  ensureOpenSpecInit();

  const changeDir = join(getChangesDir(), id);
  if (!existsSync(changeDir)) {
    output.error(`Change not found: ${id}`);
    output.info(`Run 'spazzatura spec list' to see available changes.`);
    process.exit(1);
  }

  const tasksPath = join(changeDir, 'tasks.md');
  const specPath = join(changeDir, 'spec.yaml');

  output.info(chalk.cyan.bold(`\nApplying change: ${id}`));
  output.info(chalk.dim('─'.repeat(50)));

  if (existsSync(tasksPath)) {
    const tasks = readFileSync(tasksPath, 'utf8');
    const pending = tasks.match(/- \[ \] .+/g) ?? [];
    output.info(chalk.bold('Pending tasks:'));
    for (const task of pending) {
      output.info(chalk.dim(`  ${task}`));
    }
    output.newline();
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Apply change "${id}" using AI agent?`,
      default: true,
    },
  ]);

  if (!confirm) {
    output.info('Apply cancelled.');
    return;
  }

  const specContent = existsSync(specPath) ? readFileSync(specPath, 'utf8') : '';
  const tasksContent = existsSync(tasksPath) ? readFileSync(tasksPath, 'utf8') : '';

  output.info(chalk.dim('Running agent to implement tasks...'));
  output.info(chalk.dim('Use: spazzatura agent run hephaestus'));
  output.newline();

  const router = buildSpecRouter({});
  const spinner = createSpinner('AI agent implementing tasks...');
  spinner.start();

  try {
    const response = await router.chat([
      {
        role: 'system',
        content: 'You are Hephaestus, an expert implementation agent. You implement specifications precisely and completely. List the exact files to create/modify with the complete content.',
      },
      {
        role: 'user',
        content: `Implement the following specification:\n\nSpec:\n${specContent}\n\nTasks:\n${tasksContent}\n\nProvide a complete implementation plan with file paths and code.`,
      },
    ], {});

    spinner.stop();

    output.newline();
    output.info(chalk.bold('Implementation plan:'));
    output.info(response.content);
    output.newline();
    output.success(`Change "${id}" ready for implementation.`);
    output.info(chalk.dim('Review the plan above and implement manually, or use the agent command.'));
  } catch (err) {
    spinner.stop();
    output.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function archiveChange(id: string): Promise<void> {
  ensureOpenSpecInit();

  const changeDir = join(getChangesDir(), id);
  const archiveDir = join(getOpenSpecDir(), 'archive', id);

  if (!existsSync(changeDir)) {
    output.error(`Change not found: ${id}`);
    process.exit(1);
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Archive change "${id}"?`,
      default: true,
    },
  ]);

  if (!confirm) {
    output.info('Archive cancelled.');
    return;
  }

  // Copy to archive
  mkdirSync(join(getOpenSpecDir(), 'archive'), { recursive: true });
  const { execSync } = await import('child_process');
  execSync(`cp -r "${changeDir}" "${archiveDir}"`);

  // Add archived timestamp
  const proposalPath = join(archiveDir, 'proposal.md');
  if (existsSync(proposalPath)) {
    const proposal = readFileSync(proposalPath, 'utf8');
    writeFileSync(proposalPath, proposal + `\n\n## Archived\n${new Date().toISOString()}\n`);
  }

  // Remove from changes
  execSync(`rm -rf "${changeDir}"`);

  output.success(`Change "${id}" archived.`);
}

async function extractSpec(codePath: string, options: ExtractOptions): Promise<void> {
  if (!existsSync(codePath)) {
    output.error(`Path not found: ${codePath}`);
    process.exit(1);
  }

  const outputFile = options.output ?? `${codePath.split('/').pop()?.split('.')[0] ?? 'spec'}.spec.yaml`;

  output.info(chalk.cyan(`Extracting spec from: ${codePath}`));

  // Read the code
  let codeContent = '';
  try {
    codeContent = readFileSync(codePath, 'utf8');
  } catch {
    output.error(`Could not read file: ${codePath}`);
    process.exit(1);
  }

  const router = buildSpecRouter(options);
  const spinner = createSpinner('AI analyzing code...');
  spinner.start();

  try {
    const response = await router.chat([
      {
        role: 'system',
        content: 'You are a technical architect. Extract a precise YAML specification from code. The spec should describe the interface, behavior, acceptance criteria, and notes.',
      },
      {
        role: 'user',
        content: `Extract a YAML specification from this code:\n\n\`\`\`\n${codeContent.slice(0, 8000)}\n\`\`\`\n\nOutput ONLY valid YAML, no markdown code blocks, no explanations.`,
      },
    ], {});

    spinner.stop();

    const yaml = response.content.replace(/^```ya?ml\n?/, '').replace(/```$/, '').trim();
    writeFileSync(outputFile, yaml);

    output.success(`Spec extracted to: ${outputFile}`);
  } catch (err) {
    spinner.stop();
    output.error(`Extraction failed: ${err instanceof Error ? err.message : String(err)}`);
    output.info(chalk.dim('Tip: Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY, or run Ollama locally.'));
    process.exit(1);
  }
}

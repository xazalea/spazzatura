/**
 * Spazzatura Spec Engine
 *
 * Ports the OpenSpec core engine to the Spazzatura provider abstraction.
 *
 * Key concepts:
 *  - Spec      — a parsed specification file (YAML frontmatter + Markdown body)
 *  - SpecEvent — a streaming event produced while executing a spec via an LLM
 *  - ChangeProposal — a structured description of a proposed spec mutation
 *
 * The engine is provider-agnostic: any object implementing IProvider can be
 * passed to execSpec / proposeChange.
 */

import { promises as fs } from 'fs';
import { existsSync, readFileSync } from 'fs';
import { join, dirname, basename } from 'path';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Minimal provider interface — matches the shape used by @spazzatura/provider.
 * Defined locally so this package has zero hard dependencies on the provider
 * package (it can still be used from the spec package directly).
 */
export interface IProvider {
  chat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: Record<string, unknown>
  ): Promise<{ content: string; model?: string }>;

  stream?(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: Record<string, unknown>
  ): AsyncGenerator<{ delta?: string; done?: boolean }>;
}

/** A parsed spec file. */
export interface Spec {
  /** Spec name (from frontmatter `name` or derived from filename). */
  name: string;
  /** Short description of what the spec covers. */
  description: string;
  /** Raw markdown body (everything after the frontmatter). */
  body: string;
  /** Parsed frontmatter as key-value pairs. */
  frontmatter: Record<string, string>;
  /** Absolute path to the source file. */
  filePath: string;
  /** Requirements parsed from the spec body. */
  requirements: string[];
}

/** Events emitted by execSpec while the LLM processes a spec. */
export type SpecEventKind =
  | 'start'
  | 'thought'
  | 'delta'
  | 'requirement_done'
  | 'done'
  | 'error';

export interface SpecEvent {
  kind: SpecEventKind;
  /** Streaming text delta (for kind === 'delta'). */
  delta?: string;
  /** Human-readable message. */
  message?: string;
  /** Index of the requirement being processed (for 'requirement_done'). */
  requirementIndex?: number;
  /** Error message (for kind === 'error'). */
  error?: string;
}

/** A proposed change to a spec. */
export interface ChangeProposal {
  id: string;
  specName: string;
  specFilePath: string;
  description: string;
  /** Proposed new content for the spec body. */
  proposedBody: string;
  /** Original body before the change. */
  originalBody: string;
  createdAt: string;
}

// ── Frontmatter parser ───────────────────────────────────────────────────────

function parseFrontmatter(source: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');

  if (lines[0]?.trim() !== '---') {
    return { frontmatter: {}, body: source };
  }

  const closeIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (closeIdx === -1) {
    return { frontmatter: {}, body: source };
  }

  const fmLines = lines.slice(1, closeIdx);
  const body = lines.slice(closeIdx + 1).join('\n').trimStart();

  const frontmatter: Record<string, string> = {};
  for (const line of fmLines) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
    if (key) frontmatter[key] = value;
  }

  return { frontmatter, body };
}

/** Extract bullet-point requirements from a markdown body. */
function extractRequirements(body: string): string[] {
  return body
    .split('\n')
    .filter(l => /^[-*]\s+/.test(l.trim()) || /^\d+\.\s+/.test(l.trim()))
    .map(l => l.replace(/^[-*\d.]\s+/, '').trim())
    .filter(Boolean);
}

// ── Core functions ───────────────────────────────────────────────────────────

/**
 * Parse a spec file (YAML frontmatter + Markdown body).
 *
 * @param filePath - Absolute or relative path to the .md or .yaml spec file.
 */
export async function parseSpec(filePath: string): Promise<Spec> {
  if (!existsSync(filePath)) {
    throw new Error(`Spec file not found: ${filePath}`);
  }

  const source = await fs.readFile(filePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(source);

  const name =
    frontmatter['name'] ??
    basename(filePath).replace(/\.(md|yaml|yml)$/, '');

  const description = frontmatter['description'] ?? '';
  const requirements = extractRequirements(body);

  return { name, description, body, frontmatter, filePath, requirements };
}

/**
 * Execute a spec against an LLM provider, streaming events as the model
 * processes each requirement.
 *
 * @param spec     - Parsed spec (from parseSpec).
 * @param provider - Any object with a `chat` or `stream` method.
 */
export async function* execSpec(
  spec: Spec,
  provider: IProvider
): AsyncGenerator<SpecEvent> {
  yield { kind: 'start', message: `Executing spec: ${spec.name}` };

  const systemPrompt = [
    'You are a specification analyst. For each requirement listed below,',
    'evaluate whether it is well-formed, unambiguous, and testable.',
    'Provide concise feedback for each requirement.',
  ].join(' ');

  const requirementList = spec.requirements.length > 0
    ? spec.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')
    : spec.body;

  const userPrompt =
    `Spec: ${spec.name}\n${spec.description ? `Description: ${spec.description}\n` : ''}` +
    `\nRequirements:\n${requirementList}`;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ];

  try {
    if (provider.stream) {
      for await (const chunk of provider.stream(messages, {})) {
        if (chunk.delta) {
          yield { kind: 'delta', delta: chunk.delta };
        }
        if (chunk.done) break;
      }
    } else {
      const response = await provider.chat(messages, {});
      yield { kind: 'delta', delta: response.content };
    }

    for (let i = 0; i < spec.requirements.length; i++) {
      yield { kind: 'requirement_done', requirementIndex: i };
    }

    yield { kind: 'done', message: `Spec "${spec.name}" execution complete.` };
  } catch (err) {
    yield { kind: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Propose a change to a spec using an LLM.
 *
 * The LLM is asked to suggest a new version of the spec body given the
 * natural-language description.  The proposal is returned (not yet applied).
 *
 * @param spec        - The current parsed spec.
 * @param description - Natural language description of the desired change.
 * @param provider    - LLM provider.
 */
export async function proposeChange(
  spec: Spec,
  description: string,
  provider: IProvider
): Promise<ChangeProposal> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content:
        'You are a technical writer helping maintain software specifications. ' +
        'Given an existing spec body and a change description, produce ONLY the ' +
        'updated spec body — no explanations, no markdown fences around the result.',
    },
    {
      role: 'user',
      content:
        `Current spec body:\n\n${spec.body}\n\n` +
        `Requested change: ${description}\n\n` +
        `Output the complete updated spec body:`,
    },
  ];

  const response = await provider.chat(messages, {});
  const proposedBody = response.content.trim();

  const id = `change-${Date.now()}`;

  return {
    id,
    specName: spec.name,
    specFilePath: spec.filePath,
    description,
    proposedBody,
    originalBody: spec.body,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Apply an approved ChangeProposal — overwrites the spec file with the
 * proposed body, preserving the original frontmatter.
 *
 * @param proposal - A proposal previously returned by proposeChange.
 */
export async function applyChange(proposal: ChangeProposal): Promise<void> {
  const filePath = proposal.specFilePath;

  if (!existsSync(filePath)) {
    throw new Error(`Spec file not found: ${filePath}`);
  }

  const source = await fs.readFile(filePath, 'utf-8');
  const { frontmatter } = parseFrontmatter(source);

  // Re-serialise frontmatter
  const fmLines = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: "${v}"`)
    .join('\n');

  const newSource = fmLines
    ? `---\n${fmLines}\n---\n\n${proposal.proposedBody}\n`
    : `${proposal.proposedBody}\n`;

  await fs.writeFile(filePath, newSource, 'utf-8');
}

/**
 * Bidirectional sync between a spec and code.
 *
 * Strategy:
 *  1. Read the spec file.
 *  2. Look for co-located code files (same directory, same base name).
 *  3. If code files exist, ask the LLM whether the spec still accurately
 *     describes them and write any discrepancies back to the spec as a
 *     "Sync Notes" section.
 *  4. If no co-located code exists, do nothing (spec is the source of truth).
 *
 * @param spec     - Parsed spec to sync.
 * @param provider - LLM provider (optional; if omitted, only structural sync is done).
 */
export async function syncSpec(spec: Spec, provider?: IProvider): Promise<void> {
  const specDir = dirname(spec.filePath);
  const baseName = basename(spec.filePath).replace(/\.(md|yaml|yml)$/, '');

  // Look for co-located TypeScript / JavaScript files
  const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py'];
  const codeFiles: string[] = [];

  for (const ext of codeExtensions) {
    const candidate = join(specDir, baseName + ext);
    if (existsSync(candidate)) {
      codeFiles.push(candidate);
    }
  }

  if (codeFiles.length === 0 || !provider) {
    // Nothing to sync or no provider — ensure the spec file is well-formed.
    const source = await fs.readFile(spec.filePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(source);

    // Add a sync timestamp comment at the end if not already present
    const syncMarker = `<!-- last-synced: ${new Date().toISOString().slice(0, 10)} -->`;
    if (!body.includes('<!-- last-synced:')) {
      const fmLines = Object.entries(frontmatter)
        .map(([k, v]) => `${k}: "${v}"`)
        .join('\n');

      const newSource = fmLines
        ? `---\n${fmLines}\n---\n\n${body.trimEnd()}\n\n${syncMarker}\n`
        : `${body.trimEnd()}\n\n${syncMarker}\n`;

      await fs.writeFile(spec.filePath, newSource, 'utf-8');
    }
    return;
  }

  // Read code file contents (truncated to avoid huge prompts)
  const MAX_CODE_CHARS = 6000;
  let codeContext = '';
  for (const cf of codeFiles) {
    const raw = readFileSync(cf, 'utf-8').slice(0, MAX_CODE_CHARS);
    codeContext += `\n// File: ${cf}\n${raw}\n`;
  }

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content:
        'You are a spec-code sync assistant. Compare the spec body with the ' +
        'implementation code. List any discrepancies concisely (max 200 words). ' +
        'If the spec is accurate, respond with "IN SYNC" only.',
    },
    {
      role: 'user',
      content:
        `Spec body:\n\n${spec.body}\n\nImplementation:\n${codeContext}`,
    },
  ];

  const response = await provider.chat(messages, {});
  const feedback = response.content.trim();

  if (feedback.toUpperCase() === 'IN SYNC') return;

  // Append sync notes to the spec body
  const source = await fs.readFile(spec.filePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(source);

  const syncSection =
    `\n\n## Sync Notes (${new Date().toISOString().slice(0, 10)})\n\n` +
    `> Auto-generated by \`spazzatura spec sync\`\n\n${feedback}\n`;

  const fmLines = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: "${v}"`)
    .join('\n');

  // Remove previous sync notes section before appending fresh one
  const bodyWithoutOldSync = body.replace(/\n+## Sync Notes \([\d-]+\)[\s\S]*?(?=\n## |\s*$)/, '');

  const newSource = fmLines
    ? `---\n${fmLines}\n---\n\n${bodyWithoutOldSync.trimEnd()}${syncSection}`
    : `${bodyWithoutOldSync.trimEnd()}${syncSection}`;

  await fs.writeFile(spec.filePath, newSource, 'utf-8');
}

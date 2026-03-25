/**
 * apply-patch tool
 *
 * Applies a structured patch operation (create, update, or delete) to a file
 * using the Codebuff-style "apply_patch" format.
 *
 * Ported from vendor/codebuff/sdk/src/tools/apply-patch.ts with dependency
 * substitutions to remove @codebuff/* imports.
 */

import { promises as fsp } from 'fs';
import * as path from 'path';
import type { Tool, ToolResult, JSONSchema } from '../types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PatchOperationType = 'create_file' | 'update_file' | 'delete_file';

interface PatchOperation {
  /** The operation to perform */
  type: PatchOperationType;
  /** Relative path from cwd */
  path: string;
  /** Unified diff content (required for create_file and update_file) */
  diff?: string;
}

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

function hasTraversal(targetPath: string): boolean {
  const normalized = path.normalize(targetPath);
  return path.isAbsolute(normalized) || normalized.startsWith('..');
}

// ---------------------------------------------------------------------------
// Line ending utilities
// ---------------------------------------------------------------------------

function normalizeLineEndings(input: string): string {
  return input.replace(/\r\n/g, '\n');
}

function ensureTrailingNewline(input: string): string {
  return input.endsWith('\n') ? input : `${input}\n`;
}

function stripTrailingNewline(input: string): string {
  return input.endsWith('\n') ? input.slice(0, -1) : input;
}

function isConsistentlyCrlf(input: string): boolean {
  const hasCrlf = /\r\n/.test(input);
  const hasBareLf = /(^|[^\r])\n/.test(input);
  return hasCrlf && !hasBareLf;
}

function preserveOriginalLineEndings(original: string, patched: string): string {
  if (!isConsistentlyCrlf(original)) return patched;
  return normalizeLineEndings(patched).replace(/\n/g, '\r\n');
}

function sanitizeUnifiedDiff(rawDiff: string): string {
  const diffFenceMatch = rawDiff.match(/```diff\r?\n([\s\S]*?)\r?\n```/i);
  if (diffFenceMatch) return diffFenceMatch[1]!;
  const trimmed = rawDiff.trim();
  const fencedMatch = trimmed.match(/^```(?:[a-zA-Z0-9_-]+)?\r?\n([\s\S]*?)\r?\n```$/);
  if (fencedMatch) return fencedMatch[1]!;
  return rawDiff;
}

// ---------------------------------------------------------------------------
// Chunk / diff types
// ---------------------------------------------------------------------------

type Chunk = { origIndex: number; delLines: string[]; insLines: string[] };
type ParserState = { lines: string[]; index: number; fuzz: number };
type DiffMode = 'default' | 'create';

const END_PATCH = '*** End Patch';
const END_FILE = '*** End of File';
const END_SECTION_MARKERS = [END_PATCH, '*** Update File:', '*** Delete File:', '*** Add File:', END_FILE];
const SECTION_TERMINATORS = [END_PATCH, '*** Update File:', '*** Delete File:', '*** Add File:'];

function normalizeDiffLines(diff: string): string[] {
  return diff
    .split(/\r?\n/)
    .map(l => l.replace(/\r$/, ''))
    .filter((l, idx, arr) => !(idx === arr.length - 1 && l === ''));
}

function isDone(state: ParserState, prefixes: string[]): boolean {
  if (state.index >= state.lines.length) return true;
  return prefixes.some(p => state.lines[state.index]?.startsWith(p));
}

function isWrappedAtHeader(line: string): boolean {
  return /^@@.*@@(?: .*)?$/.test(line);
}

function parseCreateDiff(lines: string[]): string {
  const filtered = lines.filter(
    l => !l.startsWith('---') && !l.startsWith('+++') && !l.startsWith('@@') && !l.startsWith('***'),
  );
  const parser: ParserState = { lines: [...filtered, END_PATCH], index: 0, fuzz: 0 };
  const output: string[] = [];
  while (!isDone(parser, SECTION_TERMINATORS)) {
    const line = parser.lines[parser.index]!;
    parser.index += 1;
    if (!line.startsWith('+')) throw new Error(`Invalid Add File Line: ${line}`);
    output.push(line.slice(1));
  }
  return output.join('\n');
}

function advanceCursorToAnchor(anchor: string, inputLines: string[], cursor: number, parser: ParserState): number {
  if (!inputLines.slice(0, cursor).some(l => l === anchor)) {
    for (let i = cursor; i < inputLines.length; i++) {
      if (inputLines[i] === anchor) return i + 1;
    }
  }
  if (!inputLines.slice(0, cursor).some(l => l.trim() === anchor.trim())) {
    for (let i = cursor; i < inputLines.length; i++) {
      if (inputLines[i]?.trim() === anchor.trim()) {
        parser.fuzz += 1;
        return i + 1;
      }
    }
  }
  return cursor;
}

function readSection(lines: string[], startIndex: number): {
  nextContext: string[]; sectionChunks: Chunk[]; endIndex: number; eof: boolean
} {
  const context: string[] = [];
  let delLines: string[] = [];
  let insLines: string[] = [];
  const sectionChunks: Chunk[] = [];
  let mode: 'keep' | 'add' | 'delete' = 'keep';
  let index = startIndex;
  const origIndex = index;

  while (index < lines.length) {
    const raw = lines[index]!;
    if (raw.startsWith('@@') || raw.startsWith(END_PATCH) || raw.startsWith('*** Update File:') ||
        raw.startsWith('*** Delete File:') || raw.startsWith('*** Add File:') || raw.startsWith(END_FILE)) break;
    if (raw === '***') break;
    if (raw.startsWith('***')) throw new Error(`Invalid Line: ${raw}`);

    index += 1;
    const lastMode: 'keep' | 'add' | 'delete' = mode;
    let line = raw === '' ? ' ' : raw;

    if (line[0] === '+') mode = 'add';
    else if (line[0] === '-') mode = 'delete';
    else if (line[0] === ' ') mode = 'keep';
    else throw new Error(`Invalid Line: ${line}`);
    line = line.slice(1);

    if (mode === 'keep' && lastMode !== mode && (insLines.length > 0 || delLines.length > 0)) {
      sectionChunks.push({ origIndex: context.length - delLines.length, delLines, insLines });
      delLines = []; insLines = [];
    }

    if (mode === 'delete') { delLines.push(line); context.push(line); }
    else if (mode === 'add') { insLines.push(line); }
    else { context.push(line); }
  }

  if (insLines.length > 0 || delLines.length > 0) {
    sectionChunks.push({ origIndex: context.length - delLines.length, delLines, insLines });
  }

  if (index < lines.length && lines[index] === END_FILE) {
    return { nextContext: context, sectionChunks, endIndex: index + 1, eof: true };
  }
  if (index === origIndex) throw new Error(`Nothing in this section - index=${index}`);
  return { nextContext: context, sectionChunks, endIndex: index, eof: false };
}

function equalsSlice(source: string[], target: string[], start: number, mapFn: (v: string) => string): boolean {
  if (start + target.length > source.length) return false;
  for (let i = 0; i < target.length; i++) {
    if (mapFn(source[start + i]!) !== mapFn(target[i]!)) return false;
  }
  return true;
}

function findContextCore(lines: string[], context: string[], start: number): { newIndex: number; fuzz: number } {
  if (context.length === 0) return { newIndex: start, fuzz: 0 };
  for (let i = start; i < lines.length; i++) if (equalsSlice(lines, context, i, v => v)) return { newIndex: i, fuzz: 0 };
  for (let i = start; i < lines.length; i++) if (equalsSlice(lines, context, i, v => v.trimEnd())) return { newIndex: i, fuzz: 1 };
  for (let i = start; i < lines.length; i++) if (equalsSlice(lines, context, i, v => v.trim())) return { newIndex: i, fuzz: 100 };
  return { newIndex: -1, fuzz: 0 };
}

function findContext(lines: string[], context: string[], start: number, eof: boolean): { newIndex: number; fuzz: number } {
  if (eof) {
    const endStart = Math.max(0, lines.length - context.length);
    const endMatch = findContextCore(lines, context, endStart);
    if (endMatch.newIndex !== -1) return endMatch;
    const fallback = findContextCore(lines, context, start);
    return { newIndex: fallback.newIndex, fuzz: fallback.fuzz + 10000 };
  }
  return findContextCore(lines, context, start);
}

function parseUpdateDiff(lines: string[], input: string): { chunks: Chunk[]; fuzz: number } {
  const parser: ParserState = { lines: [...lines, END_PATCH], index: 0, fuzz: 0 };
  const inputLines = input.split('\n');
  const chunks: Chunk[] = [];
  let cursor = 0;

  while (!isDone(parser, END_SECTION_MARKERS)) {
    const current = parser.lines[parser.index];
    const line = typeof current === 'string' ? current : '';
    const hasBareHeader = line === '@@';
    const hasWrappedHeader = isWrappedAtHeader(line);
    const hasAnchorHeader = line.startsWith('@@ ') && !hasWrappedHeader;
    const hasAnyHeader = hasBareHeader || hasWrappedHeader || hasAnchorHeader;
    let anchor = '';

    if (hasAnchorHeader) { anchor = line.slice(3); parser.index += 1; }
    else if (hasBareHeader || hasWrappedHeader) { parser.index += 1; }
    if (!(hasAnyHeader || cursor === 0)) throw new Error(`Invalid Line:\n${parser.lines[parser.index]}`);
    if (anchor.trim()) cursor = advanceCursorToAnchor(anchor, inputLines, cursor, parser);

    const { nextContext, sectionChunks, endIndex, eof } = readSection(parser.lines, parser.index);
    const { newIndex, fuzz } = findContext(inputLines, nextContext, cursor, eof);

    if (newIndex === -1) {
      const ctxText = nextContext.join('\n');
      throw new Error(eof ? `Invalid EOF Context ${cursor}:\n${ctxText}` : `Invalid Context ${cursor}:\n${ctxText}`);
    }

    parser.fuzz += fuzz;
    for (const chunk of sectionChunks) chunks.push({ ...chunk, origIndex: chunk.origIndex + newIndex });
    cursor = newIndex + nextContext.length;
    parser.index = endIndex;
  }

  return { chunks, fuzz: parser.fuzz };
}

function applyChunks(input: string, chunks: Chunk[]): string {
  const originalLines = input.split('\n');
  const dest: string[] = [];
  let origIndex = 0;
  for (const chunk of chunks) {
    if (chunk.origIndex > originalLines.length) throw new Error(`chunk.origIndex ${chunk.origIndex} > length ${originalLines.length}`);
    if (origIndex > chunk.origIndex) throw new Error(`overlapping chunk at ${chunk.origIndex}`);
    dest.push(...originalLines.slice(origIndex, chunk.origIndex));
    origIndex = chunk.origIndex;
    if (chunk.insLines.length > 0) dest.push(...chunk.insLines);
    origIndex += chunk.delLines.length;
  }
  dest.push(...originalLines.slice(origIndex));
  return dest.join('\n');
}

function patchHasIntendedChanges(diff: string): boolean {
  return normalizeLineEndings(diff).split('\n').some(l => {
    if (l.startsWith('+++') || l.startsWith('---')) return false;
    return l.startsWith('+') || l.startsWith('-');
  });
}

function applyDiff(input: string, diff: string, mode: DiffMode = 'default'): { result: string; fuzz: number } {
  const diffLines = normalizeDiffLines(diff);
  if (mode === 'create') return { result: parseCreateDiff(diffLines), fuzz: 0 };
  const { chunks, fuzz } = parseUpdateDiff(diffLines, input);
  return { result: applyChunks(input, chunks), fuzz };
}

function tryApplyPatchWithFallbacks(oldContent: string, diff: string): {
  patched: string | null; attemptedStrategies: string[]; lastError?: string
} {
  const normalizedOld = normalizeLineEndings(oldContent);
  const normalizedDiff = normalizeLineEndings(diff);
  const attempts = [
    { name: 'codex_like', source: normalizedOld, diff: normalizedDiff },
    { name: 'with_trailing_newline', source: ensureTrailingNewline(normalizedOld), diff: normalizedDiff },
    { name: 'without_trailing_newline', source: stripTrailingNewline(normalizedOld), diff: normalizedDiff },
  ];
  const attemptedStrategies: string[] = [];
  let lastError: string | undefined;
  const seen = new Set<string>();

  for (const attempt of attempts) {
    const key = JSON.stringify({ source: attempt.source, diff: attempt.diff });
    if (seen.has(key)) continue;
    seen.add(key);
    attemptedStrategies.push(attempt.name);
    try {
      const { result: patched } = applyDiff(attempt.source, attempt.diff, 'default');
      if (patchHasIntendedChanges(attempt.diff) && patched === attempt.source) {
        lastError = 'Patch produced no content changes';
        continue;
      }
      return { patched, attemptedStrategies };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { patched: null, attemptedStrategies, ...(lastError ? { lastError } : {}) };
}

// ---------------------------------------------------------------------------
// Tool class
// ---------------------------------------------------------------------------

export interface ApplyPatchConfig {
  readonly cwd?: string;
}

export class ApplyPatchTool implements Tool {
  readonly name = 'apply_patch';
  readonly description =
    'Apply a structured patch operation to a file: create, update (via unified diff), or delete.';
  readonly parameters: JSONSchema = {
    type: 'object',
    properties: {
      operation: {
        type: 'object',
        description: 'The patch operation to apply',
        properties: {
          type: {
            type: 'string',
            enum: ['create_file', 'update_file', 'delete_file'],
            description: 'Operation type',
          },
          path: { type: 'string', description: 'Relative path from working directory' },
          diff: { type: 'string', description: 'Unified diff content (required for create_file and update_file)' },
        },
        required: ['type', 'path'],
      },
    },
    required: ['operation'],
  };

  private readonly cwd: string;

  constructor(config: ApplyPatchConfig = {}) {
    this.cwd = config.cwd ?? process.cwd();
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const operation = (params as { operation?: PatchOperation }).operation;

    if (!operation || typeof operation !== 'object') {
      return { success: false, output: null, error: 'Missing or invalid "operation" object.' };
    }

    if (hasTraversal(operation.path)) {
      return { success: false, output: null, error: `Invalid path: ${operation.path}` };
    }

    const fullPath = path.join(this.cwd, operation.path);

    try {
      if (operation.type === 'create_file') {
        const diff = operation.diff ?? '';
        const sanitized = sanitizeUnifiedDiff(diff);
        const { result: content } = applyDiff('', sanitized, 'create');
        await fsp.mkdir(path.dirname(fullPath), { recursive: true });
        await fsp.writeFile(fullPath, content, 'utf-8');
        return { success: true, output: { file: operation.path, action: 'add', message: 'Applied 1 patch operation.' } };
      }

      if (operation.type === 'delete_file') {
        await fsp.unlink(fullPath);
        return { success: true, output: { file: operation.path, action: 'delete', message: 'Applied 1 patch operation.' } };
      }

      // update_file
      const sanitized = sanitizeUnifiedDiff(operation.diff ?? '');
      const oldContent = await fsp.readFile(fullPath, 'utf-8');
      const patchResult = tryApplyPatchWithFallbacks(oldContent, sanitized);

      if (!patchResult.patched) {
        const strategies = patchResult.attemptedStrategies.join(', ');
        const lastErr = patchResult.lastError ? ` Last error: ${patchResult.lastError}.` : '';
        return {
          success: false,
          output: null,
          error: `Failed to apply patch to ${operation.path}. Tried strategies: ${strategies}.${lastErr} Please re-read the file and generate a patch with exact context lines.`,
        };
      }

      await fsp.writeFile(fullPath, preserveOriginalLineEndings(oldContent, patchResult.patched), 'utf-8');
      return { success: true, output: { file: operation.path, action: 'update', message: 'Applied 1 patch operation.' } };
    } catch (err) {
      return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export function createApplyPatchTool(config?: ApplyPatchConfig): Tool {
  return new ApplyPatchTool(config);
}

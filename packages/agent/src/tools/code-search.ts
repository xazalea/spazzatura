/**
 * code-search tool
 *
 * Ripgrep-based code search within the project directory.
 *
 * Ported from vendor/codebuff/sdk/src/tools/code-search.ts.
 * The bundled ripgrep binary is NOT vendored here — this tool shells out to
 * the system `rg` binary (or the path set via SPAZZATURA_RG_PATH).
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { Tool, ToolResult, JSONSchema } from '../types.js';

// Hidden directories to include in searches beyond the default '.'.
const INCLUDED_HIDDEN_DIRS = ['.agents', '.claude', '.github', '.gitlab', '.circleci', '.husky'];

const MAX_RESULTS_PER_FILE = 15;
const GLOBAL_MAX_RESULTS = 250;
const MAX_OUTPUT_LENGTH = 20_000;
const TIMEOUT_SECONDS = 10;

// ---------------------------------------------------------------------------
// Core search function
// ---------------------------------------------------------------------------

function resolveRgPath(): string {
  return process.env.SPAZZATURA_RG_PATH ?? process.env.CODEBUFF_RG_PATH ?? 'rg';
}

function formatOutput(raw: string): string {
  // Simple pass-through; consumers can apply formatting as needed.
  return raw;
}

type SearchResult =
  | { stdout: string; stderr?: string; message?: string; errorMessage?: never }
  | { errorMessage: string; stdout?: string; stderr?: string; message?: never };

export function runCodeSearch(params: {
  projectPath: string;
  pattern: string;
  flags?: string;
  cwd?: string;
  maxResults?: number;
  globalMaxResults?: number;
  maxOutputStringLength?: number;
  timeoutSeconds?: number;
}): Promise<SearchResult> {
  return new Promise(resolve => {
    const {
      projectPath,
      pattern,
      flags,
      cwd,
      maxResults = MAX_RESULTS_PER_FILE,
      globalMaxResults = GLOBAL_MAX_RESULTS,
      maxOutputStringLength = MAX_OUTPUT_LENGTH,
      timeoutSeconds = TIMEOUT_SECONDS,
    } = params;

    let isResolved = false;
    const projectRoot = path.resolve(projectPath);
    const searchCwd = cwd ? path.resolve(projectRoot, cwd) : projectRoot;

    if (!searchCwd.startsWith(projectRoot + path.sep) && searchCwd !== projectRoot) {
      return resolve({ errorMessage: `Invalid cwd: Path '${cwd}' is outside the project directory.` });
    }

    const flagsArray = (flags ?? '')
      .split(' ')
      .filter(Boolean)
      .map(t => t.replace(/^['"]|['"]$/g, ''));

    const existingHiddenDirs = INCLUDED_HIDDEN_DIRS.filter(dir => {
      try { return fs.statSync(path.join(searchCwd, dir)).isDirectory(); } catch { return false; }
    });
    const searchPaths = ['.', ...existingHiddenDirs];
    const args = ['--no-config', '-n', '--json', ...flagsArray, '--', pattern, ...searchPaths];

    const rgPath = resolveRgPath();
    const childProcess = spawn(rgPath, args, { cwd: searchCwd, stdio: ['ignore', 'pipe', 'pipe'] });

    let jsonRemainder = '';
    let stderrBuf = '';
    const fileGroups = new Map<string, string[]>();
    const fileMatchCounts = new Map<string, number>();
    let matchesGlobal = 0;
    let estimatedOutputLen = 0;
    let killedForLimit = false;
    let killTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const settle = (payload: SearchResult) => {
      if (isResolved) return;
      isResolved = true;
      childProcess.stdout.removeAllListeners();
      childProcess.stderr.removeAllListeners();
      childProcess.removeAllListeners();
      clearTimeout(timeoutId);
      if (killTimeoutId) { clearTimeout(killTimeoutId); killTimeoutId = null; }
      resolve(payload);
    };

    const hardKill = () => {
      try { childProcess.kill('SIGTERM'); } catch {}
      killTimeoutId = setTimeout(() => {
        try { childProcess.kill('SIGKILL'); } catch { try { childProcess.kill(); } catch {} }
        killTimeoutId = null;
      }, 1000);
    };

    const timeoutId = setTimeout(() => {
      if (isResolved) return;
      hardKill();
      const partial = [...fileGroups.values()].flat().join('\n');
      settle({
        errorMessage: `Code search timed out after ${timeoutSeconds} seconds.`,
        stdout: partial.length > 1000 ? partial.slice(0, 1000) + '\n[Output truncated]' : partial,
        stderr: stderrBuf.length > 1000 ? stderrBuf.slice(0, 1000) + '\n[Error output truncated]' : stderrBuf,
      });
    }, timeoutSeconds * 1000);

    childProcess.stdout.on('data', (chunk: Buffer | string) => {
      if (isResolved) return;
      jsonRemainder += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      const lines = jsonRemainder.split('\n');
      jsonRemainder = lines.pop() ?? '';
      for (const line of lines) {
        if (!line) continue;
        let evt: any;
        try { evt = JSON.parse(line); } catch { continue; }
        if (evt.type !== 'match' && evt.type !== 'context') continue;
        const filePath = evt.data.path?.text ?? evt.data.path?.bytes ?? '';
        const lineNumber = evt.data.line_number ?? 0;
        const lineText = (evt.data.lines?.text ?? '').replace(/\r?\n$/, '');
        const formattedLine = `${filePath}:${lineNumber}:${lineText}`;
        if (!fileGroups.has(filePath)) { fileGroups.set(filePath, []); fileMatchCounts.set(filePath, 0); }
        const fileLines = fileGroups.get(filePath)!;
        const fileMatchCount = fileMatchCounts.get(filePath)!;
        const isMatch = evt.type === 'match';
        const shouldInclude = !isMatch || fileMatchCount < maxResults;
        if (shouldInclude) {
          fileLines.push(formattedLine);
          estimatedOutputLen += formattedLine.length + 1;
          if (isMatch) {
            fileMatchCounts.set(filePath, fileMatchCount + 1);
            matchesGlobal++;
            if (matchesGlobal >= globalMaxResults || estimatedOutputLen >= maxOutputStringLength) {
              killedForLimit = true;
              hardKill();
              const rawOut = [...fileGroups.values()].flat().join('\n');
              const fmtOut = formatOutput(rawOut);
              const final = fmtOut.length > maxOutputStringLength
                ? fmtOut.slice(0, maxOutputStringLength) + '\n[Output truncated]'
                : fmtOut;
              const limitReason = matchesGlobal >= globalMaxResults
                ? `[Global limit of ${globalMaxResults} results reached.]`
                : '[Output size limit reached.]';
              settle({ stdout: final + '\n\n' + limitReason, message: `Stopped early after ${matchesGlobal} match(es).` });
            }
          }
        }
      }
    });

    childProcess.stderr.on('data', (chunk: Buffer | string) => {
      if (isResolved) return;
      const limit = Math.floor(maxOutputStringLength / 5);
      if (stderrBuf.length < limit) stderrBuf += (typeof chunk === 'string' ? chunk : chunk.toString('utf8')).slice(0, limit - stderrBuf.length);
    });

    childProcess.once('close', (code) => {
      if (isResolved) return;
      // Flush remaining
      try {
        if (jsonRemainder) {
          for (const ln of (jsonRemainder.endsWith('\n') ? jsonRemainder : jsonRemainder + '\n').split('\n')) {
            if (!ln) continue;
            try {
              const evt = JSON.parse(ln);
              if (evt?.type === 'match' || evt?.type === 'context') {
                const filePath = evt.data.path?.text ?? evt.data.path?.bytes ?? '';
                const lineNumber = evt.data.line_number ?? 0;
                const lineText = (evt.data.lines?.text ?? '').replace(/\r?\n$/, '');
                const formattedLine = `${filePath}:${lineNumber}:${lineText}`;
                if (!fileGroups.has(filePath)) { fileGroups.set(filePath, []); fileMatchCounts.set(filePath, 0); }
                const fileLines = fileGroups.get(filePath)!;
                const fileMatchCount = fileMatchCounts.get(filePath)!;
                const isMatch = evt.type === 'match';
                const shouldInclude = !isMatch || (fileMatchCount < maxResults && matchesGlobal < globalMaxResults);
                if (shouldInclude) { fileLines.push(formattedLine); if (isMatch) { fileMatchCounts.set(filePath, fileMatchCount + 1); matchesGlobal++; } }
              }
            } catch {}
          }
        }
      } catch {}

      const truncatedFiles: string[] = [];
      const limitedLines: string[] = [];
      for (const [filename, fileLines] of fileGroups) {
        limitedLines.push(...fileLines);
        if ((fileMatchCounts.get(filename) ?? 0) >= maxResults) truncatedFiles.push(`${filename}: limited to ${maxResults} results per file`);
      }
      let rawOutput = limitedLines.join('\n');
      const msgs: string[] = [];
      if (truncatedFiles.length > 0) msgs.push(`Results limited to ${maxResults} per file. Truncated files:\n${truncatedFiles.join('\n')}`);
      if (killedForLimit) msgs.push(`Global limit of ${globalMaxResults} results reached.`);
      if (msgs.length > 0) rawOutput += `\n\n[${msgs.join('\n\n')}]`;
      const fmtOut = formatOutput(rawOutput);
      const truncatedStdout = fmtOut.length > maxOutputStringLength
        ? fmtOut.slice(0, maxOutputStringLength) + '\n\n[Output truncated]'
        : fmtOut;
      const truncatedStderr = stderrBuf
        ? stderrBuf + (stderrBuf.length >= Math.floor(maxOutputStringLength / 5) ? '\n\n[Error output truncated]' : '')
        : '';
      settle({
        stdout: truncatedStdout,
        ...(truncatedStderr ? { stderr: truncatedStderr } : {}),
        message: code !== null ? `Exit code: ${code}${killedForLimit ? ' (early stop)' : ''}` : '',
      });
    });

    childProcess.once('error', (error) => {
      if (isResolved) return;
      settle({ errorMessage: `Failed to execute ripgrep: ${error.message}. Ensure 'rg' is on PATH or set SPAZZATURA_RG_PATH.` });
    });
  });
}

// ---------------------------------------------------------------------------
// Tool class
// ---------------------------------------------------------------------------

export interface CodeSearchConfig {
  readonly cwd?: string;
}

export class CodeSearchTool implements Tool {
  readonly name = 'code_search';
  readonly description =
    'Search code in the project using ripgrep. Returns file paths, line numbers, and matching content.';
  readonly parameters: JSONSchema = {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Search pattern (regex or literal)' },
      flags: { type: 'string', description: 'Additional ripgrep flags (e.g. "-i" for case-insensitive, "-g *.ts" for file filter)' },
      cwd: { type: 'string', description: 'Subdirectory to search within (relative to project root)' },
    },
    required: ['pattern'],
  };

  private readonly projectPath: string;

  constructor(config: CodeSearchConfig = {}) {
    this.projectPath = config.cwd ?? process.cwd();
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { pattern, flags, cwd } = params as { pattern: string; flags?: string; cwd?: string };
    if (!pattern) return { success: false, output: null, error: 'Missing required parameter: pattern' };

    const result = await runCodeSearch({
      projectPath: this.projectPath,
      pattern,
      ...(flags !== undefined ? { flags } : {}),
      ...(cwd !== undefined ? { cwd } : {}),
    });

    if (result.errorMessage) return { success: false, output: null, error: result.errorMessage };

    return {
      success: true,
      output: { stdout: result.stdout, stderr: result.stderr, message: result.message },
    };
  }
}

export function createCodeSearchTool(config?: CodeSearchConfig): Tool {
  return new CodeSearchTool(config);
}

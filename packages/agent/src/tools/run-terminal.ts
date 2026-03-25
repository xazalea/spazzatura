/**
 * run-terminal tool
 *
 * Execute shell commands within the project directory.
 *
 * Ported from vendor/codebuff/sdk/src/tools/run-terminal-command.ts.
 * Output is truncated to prevent excessive memory usage.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Tool, ToolResult, JSONSchema } from '../types.js';

const COMMAND_OUTPUT_LIMIT = 50_000;

// ---------------------------------------------------------------------------
// Strip ANSI escape codes
// ---------------------------------------------------------------------------

function stripColors(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');
}

// ---------------------------------------------------------------------------
// Truncation
// ---------------------------------------------------------------------------

function truncateMiddle(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  const half = Math.floor(maxLength / 2);
  return str.slice(0, half) + '\n\n[...output truncated...]\n\n' + str.slice(str.length - half);
}

// ---------------------------------------------------------------------------
// Windows bash detection
// ---------------------------------------------------------------------------

const GIT_BASH_COMMON_PATHS = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  'C:\\Git\\bin\\bash.exe',
];
const WSL_PATH_PATTERNS = ['system32', 'windowsapps'];

function findWindowsBash(): string | null {
  const customPath = process.env.SPAZZATURA_GIT_BASH_PATH ?? process.env.CODEBUFF_GIT_BASH_PATH;
  if (customPath && fs.existsSync(customPath)) return customPath;
  for (const p of GIT_BASH_COMMON_PATHS) { if (fs.existsSync(p)) return p; }
  const pathEnv = process.env.PATH ?? process.env.Path ?? '';
  const wslFallbacks: string[] = [];
  for (const dir of pathEnv.split(path.delimiter)) {
    const dirLower = dir.toLowerCase();
    const isWsl = WSL_PATH_PATTERNS.some(p => dirLower.includes(p));
    for (const name of ['bash.exe', 'bash']) {
      const bp = path.join(dir, name);
      if (fs.existsSync(bp)) { if (isWsl) wslFallbacks.push(bp); else return bp; }
    }
  }
  return wslFallbacks[0] ?? null;
}

// ---------------------------------------------------------------------------
// Core execution
// ---------------------------------------------------------------------------

async function execCommand(params: {
  command: string;
  cwd: string;
  timeoutSeconds: number;
  env?: NodeJS.ProcessEnv;
}): Promise<{ stdout: string; stderr: string; exitCode: number | null; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    const { command, cwd, timeoutSeconds, env } = params;
    const isWindows = os.platform() === 'win32';
    const processEnv: NodeJS.ProcessEnv = { ...process.env, ...(env ?? {}) };

    let shell: string;
    let shellArgs: string[];

    if (isWindows) {
      const bashPath = findWindowsBash();
      if (!bashPath) {
        reject(new Error('Bash not found on Windows. Install Git for Windows or set SPAZZATURA_GIT_BASH_PATH.'));
        return;
      }
      shell = bashPath;
      shellArgs = ['-c'];
    } else {
      shell = 'bash';
      shellArgs = ['-c'];
    }

    const resolvedCwd = path.resolve(cwd);
    const childProcess = spawn(shell, [...shellArgs, command], { cwd: resolvedCwd, env: processEnv, stdio: 'pipe' });

    let stdout = '';
    let stderr = '';
    let processFinished = false;

    const timer = timeoutSeconds >= 0
      ? setTimeout(() => {
          if (!processFinished) {
            processFinished = true;
            if (!childProcess.kill('SIGTERM')) childProcess.kill('SIGKILL');
            resolve({ stdout, stderr, exitCode: null, timedOut: true });
          }
        }, timeoutSeconds * 1000)
      : null;

    childProcess.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    childProcess.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    childProcess.on('close', (exitCode) => {
      if (processFinished) return;
      processFinished = true;
      if (timer) clearTimeout(timer);
      resolve({ stdout, stderr, exitCode, timedOut: false });
    });

    childProcess.on('error', (error) => {
      if (processFinished) return;
      processFinished = true;
      if (timer) clearTimeout(timer);
      reject(new Error(`Failed to spawn command: ${error.message}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Tool class
// ---------------------------------------------------------------------------

export interface RunTerminalConfig {
  /** Working directory for commands (defaults to process.cwd()) */
  readonly cwd?: string;
  /** Default timeout in seconds (defaults to 30, -1 for no timeout) */
  readonly defaultTimeout?: number;
  /** Extra environment variables */
  readonly env?: Record<string, string>;
}

export class RunTerminalTool implements Tool {
  readonly name = 'run_terminal_command';
  readonly description =
    'Execute a shell command (bash). Returns stdout, stderr, and the exit code. Commands run in the project directory.';
  readonly parameters: JSONSchema = {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to execute' },
      cwd: { type: 'string', description: 'Subdirectory to run the command in (relative to project root)' },
      timeout_seconds: {
        type: 'number',
        description: 'Timeout in seconds (-1 for no timeout). Defaults to 30.',
        default: 30,
      },
    },
    required: ['command'],
  };

  private readonly projectPath: string;
  private readonly defaultTimeout: number;
  private readonly extraEnv: Record<string, string>;

  constructor(config: RunTerminalConfig = {}) {
    this.projectPath = config.cwd ?? process.cwd();
    this.defaultTimeout = config.defaultTimeout ?? 30;
    this.extraEnv = config.env ?? {};
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { command, cwd, timeout_seconds } = params as {
      command: string;
      cwd?: string;
      timeout_seconds?: number;
    };

    if (!command) return { success: false, output: null, error: 'Missing required parameter: command' };

    const resolvedCwd = cwd ? path.resolve(this.projectPath, cwd) : this.projectPath;
    const timeout = timeout_seconds ?? this.defaultTimeout;

    try {
      const result = await execCommand({
        command,
        cwd: resolvedCwd,
        timeoutSeconds: timeout,
        ...(Object.keys(this.extraEnv).length > 0 ? { env: this.extraEnv as NodeJS.ProcessEnv } : {}),
      });

      const truncStdout = truncateMiddle(stripColors(result.stdout), COMMAND_OUTPUT_LIMIT);
      const truncStderr = truncateMiddle(stripColors(result.stderr), COMMAND_OUTPUT_LIMIT);

      return {
        success: result.exitCode === 0 || result.exitCode === null,
        output: {
          command,
          stdout: truncStdout,
          ...(truncStderr ? { stderr: truncStderr } : {}),
          ...(result.exitCode !== null ? { exitCode: result.exitCode } : {}),
          ...(result.timedOut ? { timedOut: true } : {}),
        },
      };
    } catch (err) {
      return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export function createRunTerminalTool(config?: RunTerminalConfig): Tool {
  return new RunTerminalTool(config);
}

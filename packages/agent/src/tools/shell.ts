/**
 * Shell command execution tool
 */

import type { Tool, ToolResult, JSONSchema } from '../types.js';
import { spawn } from 'child_process';

/**
 * Shell tool configuration
 */
export interface ShellToolConfig {
  /** Allowed commands (if empty, all commands allowed) */
  readonly allowedCommands?: readonly string[];
  /** Blocked commands */
  readonly blockedCommands?: readonly string[];
  /** Default timeout in milliseconds */
  readonly timeout?: number;
  /** Working directory */
  readonly cwd?: string;
  /** Environment variables */
  readonly env?: Record<string, string>;
}

/**
 * Shell operation parameters
 */
interface ShellParams {
  readonly operation: 'execute_command';
  readonly command: string;
  readonly args?: readonly string[];
  readonly timeout?: number;
  readonly cwd?: string;
}

/**
 * Shell tool for executing shell commands
 */
export class ShellTool implements Tool {
  readonly name = 'shell';
  readonly description = 'Execute shell commands with safety checks and timeout';
  readonly parameters: JSONSchema = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['execute_command'],
        description: 'The shell operation to perform',
      },
      command: {
        type: 'string',
        description: 'The command to execute',
      },
      args: {
        type: 'array',
        items: { type: 'string' },
        description: 'Command arguments',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds',
      },
      cwd: {
        type: 'string',
        description: 'Working directory',
      },
    },
    required: ['operation', 'command'],
  };

  private readonly allowedCommands: Set<string>;
  private readonly blockedCommands: Set<string>;
  private readonly defaultTimeout: number;
  private readonly cwdValue: string | undefined;
  private readonly env: Record<string, string>;

  constructor(config: ShellToolConfig = {}) {
    this.allowedCommands = new Set(config.allowedCommands ?? []);
    this.blockedCommands = new Set(config.blockedCommands ?? [
      'rm -rf /',
      'sudo',
      'chmod 777',
      'mkfs',
      'dd',
      'format',
    ]);
    this.defaultTimeout = config.timeout ?? 30000; // 30 seconds default
    this.cwdValue = config.cwd ?? undefined;
    this.env = config.env ?? {};
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const shellParams = params as unknown as ShellParams;

    // Validate command
    const validation = this.validateCommand(shellParams.command);
    if (!validation.valid) {
      return {
        success: false,
        output: null,
        error: validation.error ?? 'Command validation failed',
      };
    }

    try {
      switch (shellParams.operation) {
        case 'execute_command':
          return await this.executeCommand(shellParams);
        default:
          return {
            success: false,
            output: null,
            error: `Unknown operation: ${(shellParams as { operation: string }).operation}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private validateCommand(command: string): { valid: boolean; error?: string } {
    // Check blocked commands
    for (const blocked of this.blockedCommands) {
      if (command.includes(blocked)) {
        return {
          valid: false,
          error: `Command blocked: contains "${blocked}"`,
        };
      }
    }

    // Check allowed commands (if specified)
    if (this.allowedCommands.size > 0) {
      const baseCommand = command.split(' ')[0];
      if (baseCommand && !this.allowedCommands.has(baseCommand)) {
        return {
          valid: false,
          error: `Command not allowed: ${baseCommand}`,
        };
      }
    }

    return { valid: true };
  }

  private async executeCommand(params: ShellParams): Promise<ToolResult> {
    const timeout = params.timeout ?? this.defaultTimeout;
    const cwd = params.cwd ?? this.cwdValue;
    const args = params.args ?? [];

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const proc = spawn(params.command, args as string[], {
        cwd,
        env: { ...process.env, ...this.env },
        shell: true,
      });

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill();
      }, timeout);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timer);

        if (timedOut) {
          resolve({
            success: false,
            output: { stdout, stderr },
            error: `Command timed out after ${timeout}ms`,
          });
          return;
        }

        if (code === 0) {
          resolve({
            success: true,
            output: {
              exitCode: code,
              stdout,
              stderr,
            },
          });
        } else {
          resolve({
            success: false,
            output: {
              exitCode: code,
              stdout,
              stderr,
            },
            error: `Command exited with code ${code}`,
          });
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timer);
        resolve({
          success: false,
          output: null,
          error: error.message,
        });
      });
    });
  }
}

/**
 * Create a shell tool with optional configuration
 */
export function createShellTool(config?: ShellToolConfig): Tool {
  return new ShellTool(config);
}

/**
 * list-directory tool
 *
 * Lists files and directories within the project root.
 *
 * Ported from vendor/codebuff/sdk/src/tools/list-directory.ts.
 */

import { promises as fsp } from 'fs';
import * as path from 'path';
import type { Tool, ToolResult, JSONSchema } from '../types.js';

// ---------------------------------------------------------------------------
// Tool class
// ---------------------------------------------------------------------------

export interface ListDirectoryConfig {
  readonly cwd?: string;
}

export class ListDirectoryTool implements Tool {
  readonly name = 'list_directory';
  readonly description =
    'List the files and subdirectories inside a directory. Returns separate arrays for files and directories.';
  readonly parameters: JSONSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the directory to list (relative to project root, or "." for root)',
      },
    },
    required: ['path'],
  };

  private readonly projectPath: string;

  constructor(config: ListDirectoryConfig = {}) {
    this.projectPath = config.cwd ?? process.cwd();
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { path: directoryPath } = params as { path: string };

    if (directoryPath === undefined || directoryPath === null) {
      return { success: false, output: null, error: 'Missing required parameter: path' };
    }

    const resolvedPath = path.resolve(this.projectPath, directoryPath);

    // Ensure path stays within project
    if (!resolvedPath.startsWith(this.projectPath)) {
      return {
        success: false,
        output: null,
        error: `Invalid path: '${directoryPath}' is outside the project directory.`,
      };
    }

    try {
      const entries = await fsp.readdir(resolvedPath, { withFileTypes: true });
      const files: string[] = [];
      const directories: string[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          directories.push(entry.name);
        } else if (entry.isFile()) {
          files.push(entry.name);
        }
      }

      return {
        success: true,
        output: { path: directoryPath, files, directories },
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, output: null, error: `Failed to list directory: ${errorMessage}` };
    }
  }
}

export function createListDirectoryTool(config?: ListDirectoryConfig): Tool {
  return new ListDirectoryTool(config);
}

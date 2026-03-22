/**
 * File operations tool
 */

import type { Tool, ToolResult, JSONSchema } from '../types.js';
import { readFile, writeFile, readdir, rm, stat, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve, relative } from 'path';

/**
 * File tool configuration
 */
export interface FileToolConfig {
  /** Base directory for file operations */
  readonly basePath?: string;
  /** Allow operations outside base path */
  readonly allowOutsideBase?: boolean;
  /** Maximum file size to read (bytes) */
  readonly maxFileSize?: number;
}

/**
 * File operation parameters
 */
interface FileReadParams {
  readonly operation: 'read_file';
  readonly path: string;
}

interface FileWriteParams {
  readonly operation: 'write_file';
  readonly path: string;
  readonly content: string;
}

interface FileListParams {
  readonly operation: 'list_directory';
  readonly path: string;
}

interface FileDeleteParams {
  readonly operation: 'delete_file';
  readonly path: string;
}

interface FileSearchParams {
  readonly operation: 'search_files';
  readonly path: string;
  readonly pattern: string;
}

interface FileMkdirParams {
  readonly operation: 'create_directory';
  readonly path: string;
}

type FileParams =
  | FileReadParams
  | FileWriteParams
  | FileListParams
  | FileDeleteParams
  | FileSearchParams
  | FileMkdirParams;

/**
 * File tool for file system operations
 */
export class FileTool implements Tool {
  readonly name = 'file';
  readonly description = 'File system operations: read, write, list, delete, search files and directories';
  readonly parameters: JSONSchema = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['read_file', 'write_file', 'list_directory', 'delete_file', 'search_files', 'create_directory'],
        description: 'The file operation to perform',
      },
      path: {
        type: 'string',
        description: 'The file or directory path',
      },
      content: {
        type: 'string',
        description: 'Content to write (for write_file operation)',
      },
      pattern: {
        type: 'string',
        description: 'Search pattern (for search_files operation)',
      },
    },
    required: ['operation', 'path'],
  };

  private readonly basePath: string;
  private readonly allowOutsideBase: boolean;
  private readonly maxFileSize: number;

  constructor(config: FileToolConfig = {}) {
    this.basePath = config.basePath ?? process.cwd();
    this.allowOutsideBase = config.allowOutsideBase ?? false;
    this.maxFileSize = config.maxFileSize ?? 10 * 1024 * 1024; // 10MB default
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const fileParams = params as unknown as FileParams;

    // Validate path
    const resolvedPath = this.resolvePath(fileParams.path);
    if (!this.allowOutsideBase && !resolvedPath.startsWith(this.basePath)) {
      return {
        success: false,
        output: null,
        error: `Access denied: path outside base directory: ${fileParams.path}`,
      };
    }

    try {
      switch (fileParams.operation) {
        case 'read_file':
          return await this.readFile(resolvedPath);
        case 'write_file':
          return await this.writeFile(resolvedPath, (fileParams as FileWriteParams).content);
        case 'list_directory':
          return await this.listDirectory(resolvedPath);
        case 'delete_file':
          return await this.deleteFile(resolvedPath);
        case 'search_files':
          return await this.searchFiles(resolvedPath, (fileParams as FileSearchParams).pattern);
        case 'create_directory':
          return await this.createDirectory(resolvedPath);
        default:
          return {
            success: false,
            output: null,
            error: `Unknown operation: ${(fileParams as { operation: string }).operation}`,
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

  private resolvePath(path: string): string {
    return resolve(this.basePath, path);
  }

  private async readFile(path: string): Promise<ToolResult> {
    if (!existsSync(path)) {
      return {
        success: false,
        output: null,
        error: `File not found: ${path}`,
      };
    }

    const stats = await stat(path);
    if (stats.size > this.maxFileSize) {
      return {
        success: false,
        output: null,
        error: `File too large: ${stats.size} bytes (max: ${this.maxFileSize})`,
      };
    }

    const content = await readFile(path, 'utf-8');
    return {
      success: true,
      output: {
        path: relative(this.basePath, path),
        content,
        size: stats.size,
      },
    };
  }

  private async writeFile(path: string, content: string): Promise<ToolResult> {
    // Ensure parent directory exists
    const parentDir = join(path, '..');
    if (!existsSync(parentDir)) {
      await mkdir(parentDir, { recursive: true });
    }

    await writeFile(path, content, 'utf-8');
    return {
      success: true,
      output: {
        path: relative(this.basePath, path),
        size: content.length,
        message: 'File written successfully',
      },
    };
  }

  private async listDirectory(path: string): Promise<ToolResult> {
    if (!existsSync(path)) {
      return {
        success: false,
        output: null,
        error: `Directory not found: ${path}`,
      };
    }

    const entries = await readdir(path, { withFileTypes: true });
    const items = entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
    }));

    return {
      success: true,
      output: {
        path: relative(this.basePath, path),
        items,
      },
    };
  }

  private async deleteFile(path: string): Promise<ToolResult> {
    if (!existsSync(path)) {
      return {
        success: false,
        output: null,
        error: `File not found: ${path}`,
      };
    }

    await rm(path, { recursive: true });
    return {
      success: true,
      output: {
        path: relative(this.basePath, path),
        message: 'Deleted successfully',
      },
    };
  }

  private async searchFiles(path: string, pattern: string): Promise<ToolResult> {
    if (!existsSync(path)) {
      return {
        success: false,
        output: null,
        error: `Directory not found: ${path}`,
      };
    }

    const results: Array<{ path: string; type: string }> = [];
    const regex = new RegExp(pattern, 'i');

    const searchDir = async (dir: string): Promise<void> => {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (regex.test(entry.name)) {
          results.push({
            path: relative(this.basePath, fullPath),
            type: entry.isDirectory() ? 'directory' : 'file',
          });
        }
        if (entry.isDirectory()) {
          await searchDir(fullPath);
        }
      }
    };

    await searchDir(path);

    return {
      success: true,
      output: {
        path: relative(this.basePath, path),
        pattern,
        results,
      },
    };
  }

  private async createDirectory(path: string): Promise<ToolResult> {
    await mkdir(path, { recursive: true });
    return {
      success: true,
      output: {
        path: relative(this.basePath, path),
        message: 'Directory created successfully',
      },
    };
  }
}

/**
 * Create a file tool with optional configuration
 */
export function createFileTool(config?: FileToolConfig): Tool {
  return new FileTool(config);
}

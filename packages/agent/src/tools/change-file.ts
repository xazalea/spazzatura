/**
 * change-file tool
 *
 * Writes or patches a file within the project root.  Supports two operation
 * types:
 *   - "file"  — overwrites the entire file with new content
 *   - "patch" — applies a unified diff to the existing file
 *
 * Ported from vendor/codebuff/sdk/src/tools/change-file.ts with dependency
 * substitutions to avoid @codebuff/* imports.
 */

import { promises as fsp } from 'fs';
import * as path from 'path';
import type { Tool, ToolResult, JSONSchema } from '../types.js';

// ---------------------------------------------------------------------------
// Minimal unified diff application (avoids external 'diff' dependency)
// Uses apply-patch internals via inline import of logic
// ---------------------------------------------------------------------------

/**
 * Apply a unified diff patch to source content.
 * Returns the patched string, or false if the patch cannot be applied.
 */
function applyPatch(source: string, patch: string): string | false {
  try {
    // Split into hunks
    const sourceLines = source.split('\n');
    const patchLines = patch.split('\n');
    const result = [...sourceLines];
    let offset = 0; // cumulative line offset from insertions/deletions

    let i = 0;
    while (i < patchLines.length) {
      const line = patchLines[i]!;
      if (line.startsWith('@@')) {
        // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (!match) { i++; continue; }
        const oldStart = parseInt(match[1]!, 10) - 1; // 0-indexed
        i++;

        // Read hunk lines
        const delLines: string[] = [];
        const insLines: string[] = [];
        while (i < patchLines.length && !patchLines[i]!.startsWith('@@') &&
               !patchLines[i]!.startsWith('diff ') && !patchLines[i]!.startsWith('---') &&
               !patchLines[i]!.startsWith('+++') && patchLines[i] !== undefined) {
          const l = patchLines[i]!;
          if (l.startsWith('-') && !l.startsWith('---')) { delLines.push(l.slice(1)); i++; }
          else if (l.startsWith('+') && !l.startsWith('+++')) { insLines.push(l.slice(1)); i++; }
          else if (l.startsWith(' ') || l === '') { delLines.push(l.startsWith(' ') ? l.slice(1) : ''); insLines.push(l.startsWith(' ') ? l.slice(1) : ''); i++; }
          else { i++; }
        }

        // Find hunk position in result (with offset)
        const applyAt = oldStart + offset;

        // Verify context/del lines match
        const contextDelLines = delLines;
        for (let j = 0; j < contextDelLines.length; j++) {
          if (result[applyAt + j] !== contextDelLines[j]) {
            // Try fuzzy match
            return false;
          }
        }

        // Apply: replace old lines with new lines
        result.splice(applyAt, contextDelLines.length, ...insLines);
        offset += insLines.length - contextDelLines.length;
        continue;
      }
      i++;
    }
    return result.join('\n');
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

function containsUpwardTraversal(p: string): boolean {
  return path.normalize(p).includes('..');
}

function containsPathTraversal(filePath: string): boolean {
  const normalized = path.normalize(filePath);
  return path.isAbsolute(normalized) || normalized.startsWith('..');
}

async function fileExists(fullPath: string): Promise<boolean> {
  try {
    await fsp.stat(fullPath);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Core implementation (extracted for testability)
// ---------------------------------------------------------------------------

interface FileChange {
  type: 'file' | 'patch';
  path: string;
  content: string;
}

interface ApplyResult {
  created: string[];
  modified: string[];
  patchFailed: string[];
  invalid: string[];
}

async function applyChanges(
  projectRoot: string,
  changes: FileChange[],
): Promise<ApplyResult> {
  const created: string[] = [];
  const modified: string[] = [];
  const patchFailed: string[] = [];
  const invalid: string[] = [];

  for (const change of changes) {
    const { path: filePath, content, type } = change;
    try {
      const fullPath = path.join(projectRoot, filePath);
      const exists = await fileExists(fullPath);

      if (!exists) {
        await fsp.mkdir(path.dirname(fullPath), { recursive: true });
      }

      if (type === 'file') {
        await fsp.writeFile(fullPath, content, 'utf-8');
      } else {
        const oldContent = await fsp.readFile(fullPath, 'utf-8');
        const newContent = applyPatch(oldContent, content);
        if (newContent === false) {
          patchFailed.push(filePath);
          continue;
        }
        await fsp.writeFile(fullPath, newContent, 'utf-8');
      }

      if (exists) {
        modified.push(filePath);
      } else {
        created.push(filePath);
      }
    } catch (err) {
      invalid.push(filePath);
    }
  }

  return { created, modified, patchFailed, invalid };
}

// ---------------------------------------------------------------------------
// Tool implementation
// ---------------------------------------------------------------------------

export interface ChangeFileParams {
  /** Operation type: write full file content or apply a unified diff */
  readonly type: 'file' | 'patch';
  /** Relative path from cwd to the target file */
  readonly path: string;
  /** Full file content (type=file) or unified diff (type=patch) */
  readonly content: string;
}

export interface ChangeFileConfig {
  /** Working directory — all paths are resolved relative to this */
  readonly cwd?: string;
}

export class ChangeFileTool implements Tool {
  readonly name = 'change_file';
  readonly description =
    'Write or patch a file. Use type="file" to overwrite the entire file, or type="patch" to apply a unified diff.';
  readonly parameters: JSONSchema = {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['file', 'patch'],
        description: 'Operation type: "file" to overwrite, "patch" to apply unified diff',
      },
      path: {
        type: 'string',
        description: 'Relative path to the file from the working directory',
      },
      content: {
        type: 'string',
        description: 'File content (for type=file) or unified diff (for type=patch)',
      },
    },
    required: ['type', 'path', 'content'],
  };

  private readonly cwd: string;

  constructor(config: ChangeFileConfig = {}) {
    this.cwd = config.cwd ?? process.cwd();
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { type, path: filePath, content } = params as unknown as ChangeFileParams;

    if (!type || !filePath || content === undefined) {
      return { success: false, output: null, error: 'Missing required parameters: type, path, content' };
    }

    if (type !== 'file' && type !== 'patch') {
      return { success: false, output: null, error: `Invalid type: "${type}". Must be "file" or "patch".` };
    }

    if (containsUpwardTraversal(this.cwd)) {
      return { success: false, output: null, error: 'cwd contains invalid path traversal' };
    }
    if (containsPathTraversal(filePath)) {
      return { success: false, output: null, error: 'file path contains invalid path traversal' };
    }

    const { created, modified, patchFailed, invalid } = await applyChanges(this.cwd, [
      { type, path: filePath, content },
    ]);

    if (patchFailed.length > 0) {
      return {
        success: false,
        output: { file: filePath },
        error: `Failed to apply patch to "${filePath}". Re-read the file and generate a patch with exact context lines.`,
      };
    }

    if (invalid.length > 0) {
      return {
        success: false,
        output: { file: filePath },
        error: `Failed to write file "${filePath}": path caused an error or file could not be written.`,
      };
    }

    if (created.length > 0) {
      return { success: true, output: { file: filePath, message: 'Created new file' } };
    }

    if (modified.length > 0) {
      return { success: true, output: { file: filePath, message: 'Updated file' } };
    }

    return { success: false, output: null, error: 'No files were modified' };
  }
}

export function createChangeFileTool(config?: ChangeFileConfig): Tool {
  return new ChangeFileTool(config);
}

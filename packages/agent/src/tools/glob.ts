/**
 * glob tool
 *
 * File glob matching within the project directory.
 *
 * Ported from vendor/codebuff/sdk/src/tools/glob.ts.
 * Uses Node's built-in glob (Node 22+) or falls back to manual directory
 * walking with micromatch-style pattern matching via minimatch.
 */

import { promises as fsp, existsSync } from 'fs';
import * as path from 'path';
import type { Tool, ToolResult, JSONSchema } from '../types.js';

// ---------------------------------------------------------------------------
// Directory walking
// ---------------------------------------------------------------------------

async function walkDir(dir: string, baseDir: string, results: string[]): Promise<void> {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      // Skip common noise directories
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      await walkDir(fullPath, baseDir, results);
    } else if (entry.isFile()) {
      results.push(relPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Simple glob matching (supports * ** ? and character classes)
// ---------------------------------------------------------------------------

function globToRegex(pattern: string): RegExp {
  // Escape special regex chars except those we handle
  let regexStr = '';
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === '*' && pattern[i + 1] === '*') {
      regexStr += '.*';
      i += 2;
      if (pattern[i] === '/') i++; // skip trailing /
    } else if (pattern[i] === '*') {
      regexStr += '[^/]*';
      i++;
    } else if (pattern[i] === '?') {
      regexStr += '[^/]';
      i++;
    } else if (pattern[i] === '[') {
      // Pass character classes through
      const end = pattern.indexOf(']', i);
      if (end !== -1) { regexStr += pattern.slice(i, end + 1); i = end + 1; }
      else { regexStr += '\\['; i++; }
    } else if ('.+^${}()|\\'.includes(pattern[i]!)) {
      regexStr += '\\' + pattern[i];
      i++;
    } else {
      regexStr += pattern[i];
      i++;
    }
  }
  return new RegExp('^' + regexStr + '$');
}

function matchGlob(filePath: string, pattern: string): boolean {
  const regex = globToRegex(pattern);
  return regex.test(filePath);
}

// ---------------------------------------------------------------------------
// Tool class
// ---------------------------------------------------------------------------

export interface GlobConfig {
  readonly cwd?: string;
}

export class GlobTool implements Tool {
  readonly name = 'glob';
  readonly description =
    'Find files matching a glob pattern in the project directory. Supports * ** ? and character classes.';
  readonly parameters: JSONSchema = {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern to match (e.g. "**/*.ts", "src/**/*.{ts,js}")',
      },
      cwd: {
        type: 'string',
        description: 'Subdirectory to search within (relative to project root)',
      },
    },
    required: ['pattern'],
  };

  private readonly projectPath: string;

  constructor(config: GlobConfig = {}) {
    this.projectPath = config.cwd ?? process.cwd();
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { pattern, cwd } = params as { pattern: string; cwd?: string };

    if (!pattern) return { success: false, output: null, error: 'Missing required parameter: pattern' };

    const searchRoot = cwd ? path.resolve(this.projectPath, cwd) : this.projectPath;

    if (!existsSync(searchRoot)) {
      return { success: false, output: null, error: `Directory not found: ${searchRoot}` };
    }

    try {
      const allFiles: string[] = [];
      await walkDir(searchRoot, this.projectPath, allFiles);

      // If cwd was specified, filter to only files within that subdirectory
      let candidateFiles = allFiles;
      if (cwd) {
        const cwdNorm = cwd.endsWith('/') ? cwd : `${cwd}/`;
        candidateFiles = allFiles.filter(
          f => f === cwd || f.startsWith(cwdNorm) || f === cwd.replace(/\/$/, ''),
        );
      }

      const matchingFiles = candidateFiles.filter(f => matchGlob(f, pattern));

      return {
        success: true,
        output: {
          files: matchingFiles,
          count: matchingFiles.length,
          message: `Found ${matchingFiles.length} file(s) matching pattern "${pattern}"${cwd ? ` in directory "${cwd}"` : ''}`,
        },
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, output: null, error: `Failed to search for files: ${errorMessage}` };
    }
  }
}

export function createGlobTool(config?: GlobConfig): Tool {
  return new GlobTool(config);
}

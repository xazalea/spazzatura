/**
 * Custom Commands — loads .spazzatura/commands/*.md files from cwd.
 *
 * Each file has YAML frontmatter:
 *   name: my-command
 *   description: What this command does
 *
 * The markdown body is the prompt template. Supported variables:
 *   {{PROMPT}}  — replaced with user-provided input
 *   {{FILES}}   — replaced with concatenated file context
 */

import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { existsSync } from 'fs';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CustomCommand {
  /** Short identifier (from frontmatter `name` or derived from filename). */
  name: string;
  /** Human-readable description shown in help output. */
  description: string;
  /** Raw template string (markdown body from the file). */
  template: string;
  /** Absolute path to the source .md file. */
  filePath: string;
}

// ── Frontmatter parser ───────────────────────────────────────────────────────

interface Frontmatter {
  name?: string;
  description?: string;
  [key: string]: string | undefined;
}

/**
 * Parse YAML-style frontmatter delimited by `---` lines.
 * Returns { frontmatter, body }.
 */
function parseFrontmatter(source: string): { frontmatter: Frontmatter; body: string } {
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

  const frontmatter: Frontmatter = {};
  for (const line of fmLines) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
    if (key) frontmatter[key] = value;
  }

  return { frontmatter, body };
}

// ── Loader ───────────────────────────────────────────────────────────────────

/**
 * Load all custom commands from `<dir>/.spazzatura/commands/`.
 * Falls back to `process.cwd()` when `dir` is not provided.
 */
export async function loadCustomCommands(dir?: string): Promise<CustomCommand[]> {
  const base = dir ?? process.cwd();
  const commandsDir = join(base, '.spazzatura', 'commands');

  if (!existsSync(commandsDir)) {
    return [];
  }

  let entries: string[];
  try {
    entries = await fs.readdir(commandsDir);
  } catch {
    return [];
  }

  const mdFiles = entries.filter(e => e.endsWith('.md'));
  const commands: CustomCommand[] = [];

  for (const file of mdFiles) {
    const filePath = join(commandsDir, file);
    try {
      const source = await fs.readFile(filePath, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(source);

      // Derive name from frontmatter or filename
      const name = frontmatter.name ?? basename(file, '.md');
      const description = frontmatter.description ?? `Custom command: ${name}`;

      commands.push({ name, description, template: body, filePath });
    } catch {
      // Skip unreadable files silently
    }
  }

  return commands;
}

// ── Template renderer ────────────────────────────────────────────────────────

/**
 * Replace `{{VAR}}` placeholders in a template string.
 *
 * @param template - The template string (typically the markdown body of a command file).
 * @param vars     - Map of variable name → replacement value.
 *                   Common keys: PROMPT, FILES.
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_match, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? (vars[key] ?? '') : `{{${key}}}`;
  });
}

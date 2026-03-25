/**
 * Skill loader
 *
 * Discovers SKILL.md files in skills/ directories, parses YAML frontmatter
 * metadata, and returns a map of loaded SkillDefinitions.
 *
 * Ported from vendor/codebuff/sdk/src/skills/load-skills.ts.
 * Dependencies on @codebuff/* are removed; frontmatter parsing uses a
 * hand-rolled YAML subset parser to avoid adding a new dependency.
 */

import { promises as fsp, existsSync } from 'fs';
import * as os from 'os';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillDefinition {
  /** Unique skill name (matches the directory name) */
  readonly name: string;
  /** Short description of what the skill does */
  readonly description: string;
  /** SPDX license identifier or free text, optional */
  readonly license?: string;
  /** Arbitrary key-value metadata from frontmatter */
  readonly metadata?: Record<string, unknown>;
  /** Full raw file content including frontmatter */
  readonly content: string;
  /** Absolute path to the SKILL.md file */
  readonly filePath: string;
}

export type SkillsMap = Record<string, SkillDefinition>;

// ---------------------------------------------------------------------------
// Frontmatter parsing (minimal YAML subset — no external dep required)
// ---------------------------------------------------------------------------

/**
 * Parses YAML-style frontmatter delimited by `---` markers.
 * Handles string, boolean, number, and simple object leaf values.
 * Returns null if no frontmatter block is present.
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } | null {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return null;

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') { endIndex = i; break; }
  }
  if (endIndex === -1) return null;

  const fmLines = lines.slice(1, endIndex);
  const body = lines.slice(endIndex + 1).join('\n');
  const frontmatter: Record<string, unknown> = {};

  for (const line of fmLines) {
    const match = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (!match) continue;
    const key = match[1]!;
    const rawValue = match[2]!.trim();

    if (rawValue === 'true') frontmatter[key] = true;
    else if (rawValue === 'false') frontmatter[key] = false;
    else if (rawValue === 'null' || rawValue === '~') frontmatter[key] = null;
    else if (/^-?\d+(\.\d+)?$/.test(rawValue)) frontmatter[key] = Number(rawValue);
    else if ((rawValue.startsWith('"') && rawValue.endsWith('"')) ||
             (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
      frontmatter[key] = rawValue.slice(1, -1);
    } else {
      frontmatter[key] = rawValue;
    }
  }

  return { frontmatter, body };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SKILL_NAME_REGEX = /^[a-z][a-z0-9-]*$/;

function isValidSkillName(name: string): boolean {
  return SKILL_NAME_REGEX.test(name);
}

function validateFrontmatter(data: Record<string, unknown>): { name: string; description: string; license?: string; metadata?: Record<string, unknown> } | null {
  if (typeof data.name !== 'string' || !data.name) return null;
  if (typeof data.description !== 'string' || !data.description) return null;
  return {
    name: data.name,
    description: data.description,
    ...(data.license !== undefined ? { license: String(data.license) } : {}),
    ...(data.metadata !== null && typeof data.metadata === 'object'
      ? { metadata: data.metadata as Record<string, unknown> }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Single skill loading
// ---------------------------------------------------------------------------

const SKILL_FILE_NAME = 'SKILL.md';
const SKILLS_DIR_NAME = 'skills';

async function loadSkillFromFile(skillDir: string, skillFilePath: string, verbose: boolean): Promise<SkillDefinition | null> {
  const dirName = path.basename(skillDir);

  let content: string;
  try {
    content = await fsp.readFile(skillFilePath, 'utf-8');
  } catch {
    if (verbose) console.error(`Failed to read skill file: ${skillFilePath}`);
    return null;
  }

  const parsed = parseFrontmatter(content);
  if (!parsed) {
    if (verbose) console.error(`Invalid frontmatter in skill file: ${skillFilePath}`);
    return null;
  }

  const validated = validateFrontmatter(parsed.frontmatter);
  if (!validated) {
    if (verbose) console.error(`Missing required frontmatter fields (name, description) in: ${skillFilePath}`);
    return null;
  }

  if (validated.name !== dirName) {
    if (verbose) console.error(`Skill name '${validated.name}' does not match directory name '${dirName}' in ${skillFilePath}`);
    return null;
  }

  return {
    name: validated.name,
    description: validated.description,
    ...(validated.license !== undefined ? { license: validated.license } : {}),
    ...(validated.metadata !== undefined ? { metadata: validated.metadata } : {}),
    content,
    filePath: skillFilePath,
  };
}

// ---------------------------------------------------------------------------
// Directory discovery
// ---------------------------------------------------------------------------

async function discoverSkillsFromDirectory(skillsDir: string, verbose: boolean): Promise<SkillsMap> {
  const skills: SkillsMap = {};

  if (!existsSync(skillsDir)) return skills;

  let entries: string[];
  try {
    entries = await fsp.readdir(skillsDir);
  } catch {
    return skills;
  }

  for (const entry of entries) {
    const skillDir = path.join(skillsDir, entry);
    try {
      const stat = await fsp.stat(skillDir);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }

    if (!isValidSkillName(entry)) {
      if (verbose) console.warn(`Skipping invalid skill directory name: ${entry}`);
      continue;
    }

    const skillFilePath = path.join(skillDir, SKILL_FILE_NAME);
    if (!existsSync(skillFilePath)) continue;

    const skill = await loadSkillFromFile(skillDir, skillFilePath, verbose);
    if (skill) skills[skill.name] = skill;
  }

  return skills;
}

// ---------------------------------------------------------------------------
// Default directories
// ---------------------------------------------------------------------------

/**
 * Returns the ordered list of skills directories to search.
 * Later directories take precedence (project overrides global).
 *
 * Order:
 *  1. ~/.claude/skills/
 *  2. ~/.agents/skills/
 *  3. {cwd}/.claude/skills/
 *  4. {cwd}/.agents/skills/
 */
function getDefaultSkillsDirs(cwd: string): string[] {
  const home = os.homedir();
  return [
    path.join(home, '.claude', SKILLS_DIR_NAME),
    path.join(home, '.agents', SKILLS_DIR_NAME),
    path.join(cwd, '.claude', SKILLS_DIR_NAME),
    path.join(cwd, '.agents', SKILLS_DIR_NAME),
  ];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LoadSkillsOptions {
  /**
   * Working directory for project-level skill discovery.
   * Defaults to process.cwd().
   */
  cwd?: string;
  /**
   * Explicit path to a specific skills directory.
   * When provided, only this directory is searched.
   */
  skillsPath?: string;
  /** Log errors to stderr during loading. */
  verbose?: boolean;
}

/**
 * Load skills from SKILL.md files in the standard locations.
 *
 * Default search order (later overrides earlier):
 *  - `~/.claude/skills/<name>/SKILL.md`
 *  - `~/.agents/skills/<name>/SKILL.md`
 *  - `{cwd}/.claude/skills/<name>/SKILL.md`
 *  - `{cwd}/.agents/skills/<name>/SKILL.md`
 *
 * @example
 * ```ts
 * const skills = await loadSkills({ verbose: true });
 * console.log(skills['git-release']?.description);
 * ```
 */
export async function loadSkills(options?: LoadSkillsOptions): Promise<SkillsMap>;
/**
 * Load skills from a single explicit directory path.
 * Mirrors the superpowers.js `loadSkills(dir)` signature.
 *
 * @param skillsDir Absolute path to a directory of skill subdirectories
 */
export async function loadSkills(skillsDir: string): Promise<Skill[]>;
export async function loadSkills(arg?: LoadSkillsOptions | string): Promise<SkillsMap | Skill[]> {
  // String overload: load from a single explicit directory → return Skill[]
  if (typeof arg === 'string') {
    const skillsDir = arg;
    const map = await discoverSkillsFromDirectory(skillsDir, false);
    return Object.values(map).map((def): Skill => ({
      name: def.name,
      description: def.description,
      content: def.content,
      dependencies: [],
      filePath: def.filePath,
      category: path.basename(path.dirname(def.filePath)),
    }));
  }

  // Options overload: search standard directories → return SkillsMap
  const { cwd = process.cwd(), skillsPath, verbose = false } = arg ?? {};
  const skills: SkillsMap = {};
  const skillsDirs = skillsPath ? [skillsPath] : getDefaultSkillsDirs(cwd);

  for (const dir of skillsDirs) {
    const dirSkills = await discoverSkillsFromDirectory(dir, verbose);
    Object.assign(skills, dirSkills);
  }

  return skills;
}

// ---------------------------------------------------------------------------
// Superpowers-compatible Skill type (flat object, parsed from SKILL.md)
// ---------------------------------------------------------------------------

/**
 * A skill as returned by `loadSkills(skillsDir: string)`.
 * Compatible with the injector's `Skill` interface.
 */
export interface Skill {
  /** Skill name from frontmatter */
  name: string;
  /** Description from frontmatter */
  description: string;
  /** Full markdown content (including frontmatter) */
  content: string;
  /** Dependent skill names (from frontmatter `dependencies` field) */
  dependencies: string[];
  /** Absolute path to the SKILL.md file */
  filePath: string;
  /** Directory (category) name containing this skill */
  category: string;
}

/**
 * Format loaded skills as an XML block suitable for inclusion in an LLM
 * system prompt.
 */
export function formatAvailableSkillsXml(skills: SkillsMap): string {
  const entries = Object.values(skills);
  if (entries.length === 0) return '';

  const items = entries
    .map(s => `  <skill name="${s.name}">\n    <description>${s.description}</description>\n  </skill>`)
    .join('\n');

  return `<available_skills>\n${items}\n</available_skills>`;
}

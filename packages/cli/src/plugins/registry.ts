/**
 * Plugin registry — loads plugins from ~/.spazzatura/plugins.json or
 * .spazzatura/plugins.json in the current working directory.
 *
 * Plugin format in plugins.json:
 * [
 *   {
 *     "name": "my-plugin",
 *     "version": "1.0.0",
 *     "description": "...",
 *     "entrypoint": "/absolute/path/to/plugin.js",
 *     "hooks": ["pre-chat", "post-chat"]
 *   }
 * ]
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Plugin {
  /** Unique plugin name (e.g. "code-review"). */
  name: string;
  /** Semantic version string. */
  version: string;
  /** Short description shown in the plugin list. */
  description: string;
  /** Absolute path to the JS entrypoint for this plugin. */
  entrypoint: string;
  /** Hook types this plugin subscribes to (e.g. ["pre-chat", "post-response"]). */
  hooks?: string[];
}

// ── Paths ────────────────────────────────────────────────────────────────────

const GLOBAL_PLUGINS_FILE = join(homedir(), '.spazzatura', 'plugins.json');
const LOCAL_PLUGINS_FILE  = join(process.cwd(), '.spazzatura', 'plugins.json');

function readPluginsFile(filePath: string): Plugin[] {
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Plugin[];
  } catch {
    return [];
  }
}

function writePluginsFile(filePath: string, plugins: Plugin[]): void {
  const dir = filePath.substring(0, filePath.lastIndexOf('/'));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(plugins, null, 2), 'utf-8');
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Load all plugins — merges global (~/.spazzatura/plugins.json) and
 * local (.spazzatura/plugins.json) registries.  Local entries win on
 * name collision.
 */
export async function loadPlugins(): Promise<Plugin[]> {
  const global = readPluginsFile(GLOBAL_PLUGINS_FILE);
  const local  = readPluginsFile(LOCAL_PLUGINS_FILE);

  // Merge: local overrides global by name
  const merged = new Map<string, Plugin>();
  for (const p of global) merged.set(p.name, p);
  for (const p of local)  merged.set(p.name, p);

  return Array.from(merged.values());
}

/**
 * Install a plugin by name or URL.
 *
 * - If `nameOrUrl` looks like a URL (http/https) or a filesystem path,
 *   it's treated as a direct entrypoint and added to the global registry.
 * - Otherwise it's treated as a package name and we attempt to resolve it
 *   from node_modules (for ecosystem compatibility).
 *
 * The plugin metadata is read from the entrypoint package.json if available,
 * or defaults are used.
 */
export async function installPlugin(nameOrUrl: string): Promise<void> {
  const isUrl  = /^https?:\/\//.test(nameOrUrl);
  const isPath = nameOrUrl.startsWith('/') || nameOrUrl.startsWith('./') || nameOrUrl.startsWith('../');

  let entrypoint: string;
  let name: string;
  let version = '0.0.0';
  let description = '';

  if (isUrl || isPath) {
    // Treat as direct entrypoint reference
    entrypoint = nameOrUrl;
    name = nameOrUrl.split('/').pop()?.replace(/\.[jt]s$/, '') ?? nameOrUrl;
  } else {
    // Try to resolve from node_modules
    try {
      const resolved = require.resolve(nameOrUrl);
      entrypoint = resolved;
      name = nameOrUrl;

      // Attempt to read package.json for metadata
      try {
        const pkgPath = require.resolve(join(nameOrUrl, 'package.json'));
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
          version?: string;
          description?: string;
          spazzatura?: { hooks?: string[] };
        };
        version = pkg.version ?? version;
        description = pkg.description ?? description;
      } catch { /* metadata is optional */ }
    } catch {
      throw new Error(
        `Cannot resolve plugin "${nameOrUrl}". ` +
        `Install it first with: npm install -g ${nameOrUrl}`
      );
    }
  }

  const plugin: Plugin = { name, version, description, entrypoint };

  const existing = readPluginsFile(GLOBAL_PLUGINS_FILE);
  const updated  = existing.filter(p => p.name !== name);
  updated.push(plugin);
  writePluginsFile(GLOBAL_PLUGINS_FILE, updated);
}

/**
 * List all installed plugins (alias for loadPlugins, kept for API symmetry).
 */
export async function listPlugins(): Promise<Plugin[]> {
  return loadPlugins();
}

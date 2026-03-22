/**
 * Configuration utility for Spazzatura
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Configuration file names
 */
const CONFIG_FILE_NAME = 'spazzatura.json';
const LOCAL_CONFIG_FILE_NAME = 'spazzatura.local.json';

/**
 * Global configuration structure
 */
export interface GlobalConfig {
  readonly providers: ProviderConfigs;
  readonly defaultProvider?: string;
  readonly logLevel?: string;
  readonly skills?: SkillConfigs;
  readonly agents?: AgentConfigs;
  readonly mcp?: MCPConfigs;
}

/**
 * Provider configurations
 */
export interface ProviderConfigs {
  readonly [key: string]: ProviderConfigEntry;
}

/**
 * Provider configuration entry
 */
export interface ProviderConfigEntry {
  readonly type: string;
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly enabled?: boolean;
}

/**
 * Skill configurations
 */
export interface SkillConfigs {
  readonly directories?: readonly string[];
  readonly registry?: string;
}

/**
 * Agent configurations
 */
export interface AgentConfigs {
  readonly directories?: readonly string[];
  readonly defaultAgent?: string;
}

/**
 * MCP configurations
 */
export interface MCPConfigs {
  readonly servers?: MCPServerConfigs;
}

/**
 * MCP server configurations
 */
export interface MCPServerConfigs {
  readonly [key: string]: MCPServerConfigEntry;
}

/**
 * MCP server configuration entry
 */
export interface MCPServerConfigEntry {
  readonly command?: string;
  readonly args?: readonly string[];
  readonly env?: Record<string, string>;
  readonly enabled?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: GlobalConfig = {
  providers: {},
  logLevel: 'info',
  skills: {
    directories: [],
  },
  agents: {
    directories: [],
  },
  mcp: {
    servers: {},
  },
};

/**
 * Get the global configuration directory
 */
export function getGlobalConfigDir(): string {
  return join(homedir(), '.spazzatura');
}

/**
 * Get the global configuration file path
 */
export function getGlobalConfigPath(): string {
  return join(getGlobalConfigDir(), CONFIG_FILE_NAME);
}

/**
 * Get the local configuration file path (in current directory)
 */
export function getLocalConfigPath(workingDir: string = process.cwd()): string {
  return join(workingDir, LOCAL_CONFIG_FILE_NAME);
}

/**
 * Check if a configuration file exists
 */
export function configExists(path: string): boolean {
  return existsSync(path);
}

/**
 * Read a configuration file
 */
export function readConfig<T>(path: string): T | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Write a configuration file
 */
export function writeConfig<T>(path: string, config: T): void {
  const content = JSON.stringify(config, null, 2);
  writeFileSync(path, content, 'utf-8');
}

/**
 * Load configuration from multiple sources
 * Priority: local > global > default
 */
export function loadConfig(workingDir: string = process.cwd()): GlobalConfig {
  // Start with default config
  let config = DEFAULT_CONFIG;

  // Load global config
  const globalConfigPath = getGlobalConfigPath();
  const globalConfig = readConfig<Partial<GlobalConfig>>(globalConfigPath);
  if (globalConfig) {
    config = deepMerge(config, globalConfig);
  }

  // Load local config
  const localConfigPath = getLocalConfigPath(workingDir);
  const localConfig = readConfig<Partial<GlobalConfig>>(localConfigPath);
  if (localConfig) {
    config = deepMerge(config, localConfig);
  }

  return config;
}

/**
 * Save configuration to the global config file
 */
export function saveGlobalConfig(config: GlobalConfig): void {
  const configPath = getGlobalConfigPath();
  writeConfig(configPath, config);
}

/**
 * Save configuration to the local config file
 */
export function saveLocalConfig(config: Partial<GlobalConfig>, workingDir: string = process.cwd()): void {
  const configPath = getLocalConfigPath(workingDir);
  writeConfig(configPath, config);
}

/**
 * Deep merge two objects
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue !== undefined &&
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(targetValue, sourceValue as Partial<typeof targetValue>) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Initialize configuration with defaults
 */
export function initConfig(_workingDir: string = process.cwd()): void {
  const globalConfigDir = getGlobalConfigDir();
  const globalConfigPath = getGlobalConfigPath();

  // Create global config directory if it doesn't exist
  if (!existsSync(globalConfigDir)) {
    require('node:fs').mkdirSync(globalConfigDir, { recursive: true });
  }

  // Create global config file if it doesn't exist
  if (!existsSync(globalConfigPath)) {
    saveGlobalConfig(DEFAULT_CONFIG);
  }
}

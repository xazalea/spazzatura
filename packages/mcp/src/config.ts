/**
 * MCP Configuration Loader
 * Loads and validates MCP server configurations
 */

import { readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type {
  MCPServerConfig,
  MCPServerConfigEntry,
  MCPConfigFile,
  MCPConfigValidationResult,
} from './types.js';

/**
 * Default configuration file names
 */
const CONFIG_FILE_NAMES = [
  'mcp-config.yaml',
  'mcp-config.yml',
  'mcp-config.json',
  '.mcp-config.yaml',
  '.mcp-config.yml',
  '.mcp-config.json',
];

/**
 * Environment variable pattern for expansion
 */
const ENV_VAR_PATTERN = /\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g;

/**
 * Expand environment variables in a string
 */
export function expandEnvVars(value: string): string {
  return value.replace(ENV_VAR_PATTERN, (match, braced: string | undefined, unbraced: string | undefined) => {
    const varName = braced || unbraced;
    const envValue = process.env[varName];
    if (envValue === undefined) {
      console.warn(`Warning: Environment variable not found: ${varName}`);
      return match;
    }
    return envValue;
  });
}

/**
 * Recursively expand environment variables in an object
 */
export function expandEnvVarsInObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return expandEnvVars(obj) as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map((item) => expandEnvVarsInObject(item)) as T;
  }
  
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = expandEnvVarsInObject(value);
    }
    return result as T;
  }
  
  return obj;
}

/**
 * Parse YAML configuration (simple parser for MCP config format)
 */
function parseYaml(content: string): Record<string, unknown> {
  const lines = content.split('\n');
  const result: Record<string, unknown> = {};
  let currentSection: string | null = null;
  let currentServer: string | null = null;
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;
  let currentEnv: Record<string, string> | null = null;
  
  for (const line of lines) {
    // Skip empty lines and comments
    if (line.trim() === '' || line.trim().startsWith('#')) {
      continue;
    }
    
    const indent = line.search(/\S/);
    const trimmed = line.trim();
    
    // Top-level key (mcpServers)
    if (indent === 0) {
      if (trimmed.endsWith(':')) {
        currentSection = trimmed.slice(0, -1);
        result[currentSection] = {};
        currentServer = null;
      }
      continue;
    }
    
    // Server name (under mcpServers)
    if (currentSection === 'mcpServers' && indent === 2 && trimmed.endsWith(':')) {
      currentServer = trimmed.slice(0, -1);
      (result.mcpServers as Record<string, unknown>)[currentServer] = {};
      continue;
    }
    
    // Server properties
    if (currentServer && indent === 4) {
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.slice(0, colonIndex).trim();
        const value = trimmed.slice(colonIndex + 1).trim();
        
        if (key === 'args') {
          currentArray = [];
          (result.mcpServers as Record<string, MCPServerConfigEntry>)[currentServer].args = currentArray;
          currentKey = 'args';
        } else if (key === 'env') {
          currentEnv = {};
          (result.mcpServers as Record<string, MCPServerConfigEntry>)[currentServer].env = currentEnv;
          currentKey = 'env';
        } else if (value) {
          // Parse the value
          let parsedValue: string | number | boolean = value;
          if (value === 'true') parsedValue = true;
          else if (value === 'false') parsedValue = false;
          else if (!isNaN(Number(value))) parsedValue = Number(value);
          else if (value.startsWith('"') && value.endsWith('"')) {
            parsedValue = value.slice(1, -1);
          }
          
          (result.mcpServers as Record<string, MCPServerConfigEntry>)[currentServer][key as keyof MCPServerConfigEntry] = parsedValue as never;
        }
      }
      continue;
    }
    
    // Array items (args)
    if (currentArray && indent === 6 && trimmed.startsWith('-')) {
      const value = trimmed.slice(1).trim();
      // Remove quotes if present
      const cleanValue = value.startsWith('"') && value.endsWith('"') 
        ? value.slice(1, -1) 
        : value;
      currentArray.push(cleanValue);
      continue;
    }
    
    // Env items
    if (currentEnv && indent === 6) {
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.slice(0, colonIndex).trim();
        const value = trimmed.slice(colonIndex + 1).trim();
        // Remove quotes if present
        const cleanValue = value.startsWith('"') && value.endsWith('"') 
          ? value.slice(1, -1) 
          : value;
        currentEnv[key] = cleanValue;
      }
      continue;
    }
  }
  
  return result;
}

/**
 * Load configuration from a file
 */
export async function loadConfigFile(filePath: string): Promise<MCPConfigFile> {
  const content = await readFile(filePath, 'utf-8');
  
  if (filePath.endsWith('.json')) {
    const parsed = JSON.parse(content);
    return expandEnvVarsInObject(parsed);
  }
  
  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
    const parsed = parseYaml(content);
    return expandEnvVarsInObject(parsed as MCPConfigFile);
  }
  
  throw new Error(`Unsupported config file format: ${filePath}`);
}

/**
 * Find configuration file in directory
 */
export async function findConfigFile(
  startDir: string = process.cwd()
): Promise<string | null> {
  for (const name of CONFIG_FILE_NAMES) {
    const filePath = join(startDir, name);
    try {
      await access(filePath);
      return filePath;
    } catch {
      // File doesn't exist, continue
    }
  }
  return null;
}

/**
 * Validate a server configuration entry
 */
export function validateServerConfigEntry(
  name: string,
  entry: MCPServerConfigEntry
): MCPConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check required fields
  if (!entry.command) {
    errors.push(`Server '${name}': 'command' is required`);
  }
  
  // Check command is valid
  if (entry.command) {
    const validCommands = ['npx', 'node', 'python', 'python3', 'uvx'];
    if (!validCommands.includes(entry.command) && !entry.command.startsWith('/')) {
      warnings.push(
        `Server '${name}': command '${entry.command}' is not a common MCP server command`
      );
    }
  }
  
  // Check args format
  if (entry.args) {
    if (!Array.isArray(entry.args)) {
      errors.push(`Server '${name}': 'args' must be an array`);
    }
  }
  
  // Check env format
  if (entry.env) {
    if (typeof entry.env !== 'object') {
      errors.push(`Server '${name}': 'env' must be an object`);
    } else {
      for (const [key, value] of Object.entries(entry.env)) {
        if (typeof value !== 'string') {
          errors.push(
            `Server '${name}': env variable '${key}' must be a string`
          );
        }
      }
    }
  }
  
  // Check timeout
  if (entry.timeout !== undefined) {
    if (typeof entry.timeout !== 'number' || entry.timeout <= 0) {
      errors.push(`Server '${name}': 'timeout' must be a positive number`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate entire configuration file
 */
export function validateConfigFile(
  config: MCPConfigFile
): MCPConfigValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  
  if (config.mcpServers) {
    for (const [name, entry] of Object.entries(config.mcpServers)) {
      const result = validateServerConfigEntry(name, entry);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }
  }
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Convert config entry to server config
 */
export function configEntryToServerConfig(
  id: string,
  entry: MCPServerConfigEntry
): MCPServerConfig {
  const config: MCPServerConfig = {
    id,
    name: id,
    transport: 'stdio',
    command: entry.command,
  };
  
  if (entry.args) {
    (config as { args: readonly string[] }).args = entry.args;
  }
  if (entry.env) {
    (config as { env: Record<string, string> }).env = entry.env;
  }
  if (entry.cwd) {
    (config as { cwd: string }).cwd = entry.cwd;
  }
  if (entry.timeout) {
    (config as { timeout: number }).timeout = entry.timeout;
  }
  if (entry.disabled) {
    (config as { disabled: boolean }).disabled = entry.disabled;
  }
  
  return config;
}

/**
 * Load and validate configuration
 */
export async function loadConfig(
  filePath?: string
): Promise<{
  config: MCPConfigFile;
  serverConfigs: MCPServerConfig[];
  validation: MCPConfigValidationResult;
}> {
  // Find config file if not specified
  const configPath = filePath || (await findConfigFile());
  
  if (!configPath) {
    return {
      config: {},
      serverConfigs: [],
      validation: {
        valid: true,
        errors: [],
        warnings: ['No configuration file found'],
      },
    };
  }
  
  // Load config
  const config = await loadConfigFile(configPath);
  
  // Validate
  const validation = validateConfigFile(config);
  
  // Convert to server configs
  const serverConfigs: MCPServerConfig[] = [];
  if (config.mcpServers) {
    for (const [id, entry] of Object.entries(config.mcpServers)) {
      if (!entry.disabled) {
        serverConfigs.push(configEntryToServerConfig(id, entry));
      }
    }
  }
  
  return {
    config,
    serverConfigs,
    validation,
  };
}

/**
 * Generate sample configuration
 */
export function generateSampleConfig(): string {
  return `# MCP Server Configuration
# This file configures MCP servers for Spazzatura

mcpServers:
  # Filesystem server - provides file operations
  filesystem:
    command: npx
    args:
      - '-y'
      - '@modelcontextprotocol/server-filesystem'
      - '/path/to/allowed/directory'
  
  # GitHub server - provides GitHub API access
  github:
    command: npx
    args:
      - '-y'
      - '@modelcontextprotocol/server-github'
    env:
      GITHUB_TOKEN: \${GITHUB_TOKEN}
  
  # PostgreSQL server - provides database access
  postgres:
    command: npx
    args:
      - '-y'
      - '@modelcontextprotocol/server-postgres'
    env:
      DATABASE_URL: \${DATABASE_URL}
  
  # Brave Search server - provides web search
  brave-search:
    command: npx
    args:
      - '-y'
      - '@modelcontextprotocol/server-brave-search'
    env:
      BRAVE_API_KEY: \${BRAVE_API_KEY}
    disabled: true  # Disable this server
`;
}

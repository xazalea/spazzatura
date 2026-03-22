/**
 * Agent loader
 * Loads agents from configuration files, npm packages, and built-in definitions
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import type { AgentConfig, Tool, IAgent } from './types.js';
import { Agent } from './agent.js';

/**
 * Loader configuration
 */
export interface LoaderConfig {
  /** Base path for loading agents */
  readonly basePath?: string;
  /** Built-in agents path */
  readonly builtinPath?: string;
}

/**
 * Agent file configuration (YAML/JSON format)
 */
export interface AgentFileConfig {
  /** Agent name */
  readonly name: string;
  /** Agent description */
  readonly description?: string;
  /** System prompt */
  readonly systemPrompt: string;
  /** Model configuration */
  readonly model?: {
    readonly provider?: string;
    readonly model?: string;
    readonly temperature?: number;
    readonly maxTokens?: number;
  };
  /** Tool names to load */
  readonly tools?: readonly string[];
  /** Memory configuration */
  readonly memory?: {
    readonly type?: 'none' | 'buffer' | 'window' | 'summary';
    readonly maxSize?: number;
  };
  /** Maximum iterations */
  readonly maxIterations?: number;
}

/**
 * Agent loader for loading from various sources
 */
export class AgentLoader {
  private readonly builtinPath: string;
  private readonly toolRegistry: Map<string, Tool> = new Map();

  constructor(config: LoaderConfig = {}) {
    this.builtinPath = config.builtinPath ?? join(__dirname, 'builtin');
  }

  /**
   * Register a tool for use by loaded agents
   */
  registerTool(tool: Tool): void {
    this.toolRegistry.set(tool.name, tool);
  }

  /**
   * Load an agent from a configuration object
   */
  loadFromConfig(config: AgentFileConfig): IAgent {
    const tools = this.resolveTools(config.tools ?? []);

    const agentConfig: AgentConfig = {
      name: config.name,
      systemPrompt: config.systemPrompt,
      tools,
      ...(config.description !== undefined && { description: config.description }),
      ...(config.model !== undefined && { model: config.model }),
      ...(config.memory !== undefined && {
        memory: {
          type: config.memory.type ?? 'buffer',
          ...(config.memory.maxSize !== undefined && { maxSize: config.memory.maxSize }),
        } as { type: 'none' | 'buffer' | 'window' | 'summary'; maxSize?: number }
      }),
      ...(config.maxIterations !== undefined && { maxIterations: config.maxIterations }),
    };

    return new Agent(agentConfig);
  }

  /**
   * Load an agent from a JSON file
   */
  async loadFromJson(filePath: string): Promise<IAgent> {
    const content = await readFile(filePath, 'utf-8');
    const config = JSON.parse(content) as AgentFileConfig;
    return this.loadFromConfig(config);
  }

  /**
   * Load an agent from a YAML-like file (simplified parsing)
   */
  async loadFromYaml(filePath: string): Promise<IAgent> {
    const content = await readFile(filePath, 'utf-8');
    const config = this.parseYaml(content);
    return this.loadFromConfig(config);
  }

  /**
   * Load an agent from a file (auto-detect format)
   */
  async loadFromFile(filePath: string): Promise<IAgent> {
    const ext = extname(filePath).toLowerCase();

    switch (ext) {
      case '.json':
        return this.loadFromJson(filePath);
      case '.yaml':
      case '.yml':
        return this.loadFromYaml(filePath);
      default:
        throw new Error(`Unsupported file format: ${ext}`);
    }
  }

  /**
   * Load all agents from a directory
   */
  async loadFromDirectory(dirPath: string): Promise<IAgent[]> {
    const agents: IAgent[] = [];
    const entries = await readdir(dirPath);

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stats = await stat(fullPath);

      if (stats.isFile()) {
        const ext = extname(entry).toLowerCase();
        if (['.json', '.yaml', '.yml'].includes(ext)) {
          try {
            const agent = await this.loadFromFile(fullPath);
            agents.push(agent);
          } catch (error) {
            console.warn(`Failed to load agent from ${entry}:`, error);
          }
        }
      }
    }

    return agents;
  }

  /**
   * Load a built-in agent by name
   */
  async loadBuiltin(name: string): Promise<IAgent> {
    const filePath = join(this.builtinPath, `${name}.json`);
    return this.loadFromJson(filePath);
  }

  /**
   * List available built-in agents
   */
  async listBuiltin(): Promise<string[]> {
    try {
      const entries = await readdir(this.builtinPath);
      return entries
        .filter((e) => e.endsWith('.json'))
        .map((e) => e.replace('.json', ''));
    } catch {
      return [];
    }
  }

  /**
   * Resolve tool names to tool instances
   */
  private resolveTools(toolNames: readonly string[]): Tool[] {
    const tools: Tool[] = [];

    for (const name of toolNames) {
      const tool = this.toolRegistry.get(name);
      if (tool) {
        tools.push(tool);
      } else {
        console.warn(`Tool not found: ${name}`);
      }
    }

    return tools;
  }

  /**
   * Simple YAML parser for agent configs
   * Note: In production, use a proper YAML library
   */
  private parseYaml(content: string): AgentFileConfig {
    const lines = content.split('\n');
    const result: Record<string, unknown> = {};
    let currentObject: Record<string, unknown> = result;
    let inMultiline = false;
    let multilineKey = '';
    let multilineValue: string[] = [];

    for (const line of lines) {
      // Handle multiline strings
      if (inMultiline) {
        if (line.startsWith('  ') || line === '') {
          multilineValue.push(line);
          continue;
        } else {
          currentObject[multilineKey] = multilineValue.join('\n').trim();
          inMultiline = false;
          multilineValue = [];
        }
      }

      // Skip comments and empty lines
      if (line.startsWith('#') || line.trim() === '') continue;

      // Parse key-value pairs
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();

      // Handle nested objects
      if (value === '' && lines[lines.indexOf(line) + 1]?.startsWith('  ')) {
        currentObject[key] = {};
        currentObject = currentObject[key] as Record<string, unknown>;
        continue;
      }

      // Handle multiline strings (like systemPrompt)
      if (value === '' && key === 'systemPrompt') {
        inMultiline = true;
        multilineKey = key;
        continue;
      }

      // Handle arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1);
        currentObject[key] = value.split(',').map((v) => v.trim().replace(/['"]/g, ''));
        continue;
      }

      // Handle quoted strings
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        currentObject[key] = value.slice(1, -1);
        continue;
      }

      // Handle numbers
      const numValue = Number(value);
      if (!isNaN(numValue)) {
        currentObject[key] = numValue;
        continue;
      }

      // Handle booleans
      if (value === 'true') {
        currentObject[key] = true;
        continue;
      }
      if (value === 'false') {
        currentObject[key] = false;
        continue;
      }

      currentObject[key] = value;

      // Reset to root level if not indented
      if (!line.startsWith('  ')) {
        currentObject = result;
      }
    }

    // Handle any remaining multiline value
    if (inMultiline && multilineValue.length > 0) {
      currentObject[multilineKey] = multilineValue.join('\n').trim();
    }

    return result as unknown as AgentFileConfig;
  }
}

/**
 * Create an agent loader
 */
export function createAgentLoader(config?: LoaderConfig): AgentLoader {
  return new AgentLoader(config);
}

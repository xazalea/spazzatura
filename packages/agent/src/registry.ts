/**
 * Agent registry
 * Manages agent registration, discovery, and lifecycle
 */

import type { IAgent, IAgentRegistry } from './types.js';

/**
 * Registry configuration
 */
export interface RegistryConfig {
  /** Enable persistence */
  readonly persist?: boolean;
  /** Persistence path */
  readonly persistPath?: string;
}

/**
 * Agent registry implementation
 */
export class AgentRegistry implements IAgentRegistry {
  private readonly agents: Map<string, IAgent> = new Map();
  private readonly persist: boolean;

  constructor(config: RegistryConfig = {}) {
    this.persist = config.persist ?? false;
  }

  /**
   * Register an agent
   */
  register(agent: IAgent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent already registered: ${agent.id}`);
    }
    this.agents.set(agent.id, agent);
    this.saveIfNeeded();
  }

  /**
   * Unregister an agent
   */
  unregister(agentId: string): void {
    this.agents.delete(agentId);
    this.saveIfNeeded();
  }

  /**
   * Get an agent by ID
   */
  get(agentId: string): IAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * List all registered agents
   */
  list(): readonly IAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Check if an agent exists
   */
  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Find agents by name
   */
  findByName(name: string): IAgent[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.name === name
    );
  }

  /**
   * Find agents by capability (tools they have)
   */
  findByTool(toolName: string): IAgent[] {
    return Array.from(this.agents.values()).filter((agent) => {
      const config = agent.config;
      return config.tools?.some((tool) => tool.name === toolName);
    });
  }

  /**
   * Clear all agents
   */
  clear(): void {
    this.agents.clear();
    this.saveIfNeeded();
  }

  /**
   * Get registry size
   */
  get size(): number {
    return this.agents.size;
  }

  /**
   * Save registry to disk if persistence is enabled
   */
  private saveIfNeeded(): void {
    if (this.persist) {
      // In a real implementation, this would save to disk
      // For now, it's a no-op
    }
  }

  /**
   * Load registry from disk
   */
  async load(): Promise<void> {
    if (!this.persist) return;

    // In a real implementation, this would load from disk
    // For now, it's a no-op
  }
}

/**
 * Create an agent registry
 */
export function createAgentRegistry(config?: RegistryConfig): IAgentRegistry {
  return new AgentRegistry(config);
}

/**
 * Global default registry instance
 */
let defaultRegistry: IAgentRegistry | undefined;

/**
 * Get the default registry
 */
export function getDefaultRegistry(): IAgentRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new AgentRegistry();
  }
  return defaultRegistry;
}

/**
 * Set the default registry
 */
export function setDefaultRegistry(registry: IAgentRegistry): void {
  defaultRegistry = registry;
}

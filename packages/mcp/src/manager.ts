/**
 * MCP Manager Implementation
 * Manages multiple MCP server connections
 */

import { EventEmitter } from 'events';
import { MCPClient, createMCPClient } from './client.js';
import type {
  MCPServerId,
  MCPServerConfig,
  MCPServer,
  MCPServerConnectionStatus,
  MCPTool,
  MCPToolResult,
  MCPResource,
  MCPResourceReadResult,
  MCPPrompt,
  MCPPromptResult,
  IMCPManager,
} from './types.js';

/**
 * MCP Server Manager
 * Coordinates multiple MCP server connections
 */
export class MCPManager extends EventEmitter implements IMCPManager {
  readonly servers: Map<MCPServerId, MCPServer> = new Map();
  readonly clients: Map<MCPServerId, MCPClient> = new Map();

  constructor() {
    super();
  }

  // ============================================================================
  // Server Management
  // ============================================================================

  /**
   * Add a new MCP server configuration
   */
  async addServer(config: MCPServerConfig): Promise<MCPServer> {
    if (this.servers.has(config.id)) {
      throw new Error(`Server already exists: ${config.id}`);
    }

    // Create server entry
    const server: MCPServer = {
      id: config.id,
      config,
      status: 'disconnected',
      capabilities: undefined,
      serverInfo: undefined,
      error: undefined,
      lastPing: undefined,
    };

    this.servers.set(config.id, server);

    // Create client
    const client = createMCPClient(config);
    this.clients.set(config.id, client);

    // Forward client events
    client.on('connected', () => {
      this.emit('serverConnected', config.id);
    });

    client.on('disconnected', () => {
      this.emit('serverDisconnected', config.id);
    });

    client.on('error', (error) => {
      this.emit('serverError', { serverId: config.id, error });
    });

    client.on('toolsChanged', (data) => {
      this.emit('toolsChanged', data);
    });

    client.on('resourcesChanged', (data) => {
      this.emit('resourcesChanged', data);
    });

    client.on('promptsChanged', (data) => {
      this.emit('promptsChanged', data);
    });

    return server;
  }

  /**
   * Remove an MCP server
   */
  async removeServer(id: MCPServerId): Promise<void> {
    const client = this.clients.get(id);
    if (client) {
      await client.disconnect();
      this.clients.delete(id);
    }

    this.servers.delete(id);
  }

  /**
   * Get server by ID
   */
  getServer(id: MCPServerId): MCPServer | undefined {
    return this.servers.get(id);
  }

  /**
   * List all servers
   */
  listServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Connect to a specific server
   */
  async connect(id: MCPServerId): Promise<void> {
    const client = this.clients.get(id);
    const server = this.servers.get(id);

    if (!client || !server) {
      throw new Error(`Server not found: ${id}`);
    }

    if (server.config.disabled) {
      throw new Error(`Server is disabled: ${id}`);
    }

    // Update server status
    this.updateServerStatus(id, 'connecting');

    try {
      await client.connect();
      this.updateServerStatus(id, client.status);
    } catch (error) {
      this.updateServerStatus(id, 'error', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Disconnect from a specific server
   */
  async disconnect(id: MCPServerId): Promise<void> {
    const client = this.clients.get(id);

    if (!client) {
      return;
    }

    await client.disconnect();
    this.updateServerStatus(id, 'disconnected');
  }

  /**
   * Connect to all servers
   */
  async connectAll(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [id, server] of this.servers) {
      if (!server.config.disabled) {
        promises.push(
          this.connect(id).catch((error) => {
            // Log error but continue connecting other servers
            this.emit('connectionError', { serverId: id, error });
          })
        );
      }
    }

    await Promise.allSettled(promises);
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const id of this.clients.keys()) {
      promises.push(this.disconnect(id));
    }

    await Promise.all(promises);
  }

  // ============================================================================
  // Tool Aggregation
  // ============================================================================

  /**
   * List all tools from all connected servers
   */
  async listAllTools(): Promise<Map<MCPServerId, MCPTool[]>> {
    const result = new Map<MCPServerId, MCPTool[]>();

    for (const [id, client] of this.clients) {
      if (client.isConnected()) {
        try {
          const tools = await client.listTools();
          result.set(id, tools);
        } catch (error) {
          // Log error but continue with other servers
          this.emit('error', { serverId: id, error });
        }
      }
    }

    return result;
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(
    serverId: MCPServerId,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const client = this.clients.get(serverId);

    if (!client) {
      throw new Error(`Server not found: ${serverId}`);
    }

    if (!client.isConnected()) {
      throw new Error(`Server not connected: ${serverId}`);
    }

    return client.callTool(toolName, args);
  }

  /**
   * Find which server provides a specific tool
   */
  async findToolServer(toolName: string): Promise<MCPServerId | undefined> {
    for (const [id, client] of this.clients) {
      if (client.isConnected()) {
        try {
          const tools = await client.listTools();
          if (tools.some((tool) => tool.name === toolName)) {
            return id;
          }
        } catch {
          // Continue searching other servers
        }
      }
    }
    return undefined;
  }

  /**
   * Call a tool by name, automatically finding the server
   */
  async callToolByName(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{ serverId: MCPServerId; result: MCPToolResult }> {
    const serverId = await this.findToolServer(toolName);

    if (!serverId) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const result = await this.callTool(serverId, toolName, args);
    return { serverId, result };
  }

  // ============================================================================
  // Resource Aggregation
  // ============================================================================

  /**
   * List all resources from all connected servers
   */
  async listAllResources(): Promise<Map<MCPServerId, MCPResource[]>> {
    const result = new Map<MCPServerId, MCPResource[]>();

    for (const [id, client] of this.clients) {
      if (client.isConnected()) {
        try {
          const resources = await client.listResources();
          result.set(id, resources);
        } catch (error) {
          this.emit('error', { serverId: id, error });
        }
      }
    }

    return result;
  }

  /**
   * Read a resource from a specific server
   */
  async readResource(
    serverId: MCPServerId,
    uri: string
  ): Promise<MCPResourceReadResult> {
    const client = this.clients.get(serverId);

    if (!client) {
      throw new Error(`Server not found: ${serverId}`);
    }

    if (!client.isConnected()) {
      throw new Error(`Server not connected: ${serverId}`);
    }

    return client.readResource(uri);
  }

  /**
   * Find which server provides a specific resource
   */
  async findResourceServer(uri: string): Promise<MCPServerId | undefined> {
    for (const [id, client] of this.clients) {
      if (client.isConnected()) {
        try {
          const resources = await client.listResources();
          if (resources.some((resource) => resource.uri === uri)) {
            return id;
          }
        } catch {
          // Continue searching other servers
        }
      }
    }
    return undefined;
  }

  // ============================================================================
  // Prompt Aggregation
  // ============================================================================

  /**
   * List all prompts from all connected servers
   */
  async listAllPrompts(): Promise<Map<MCPServerId, MCPPrompt[]>> {
    const result = new Map<MCPServerId, MCPPrompt[]>();

    for (const [id, client] of this.clients) {
      if (client.isConnected()) {
        try {
          const prompts = await client.listPrompts();
          result.set(id, prompts);
        } catch (error) {
          this.emit('error', { serverId: id, error });
        }
      }
    }

    return result;
  }

  /**
   * Get a prompt from a specific server
   */
  async getPrompt(
    serverId: MCPServerId,
    name: string,
    args?: Record<string, string>
  ): Promise<MCPPromptResult> {
    const client = this.clients.get(serverId);

    if (!client) {
      throw new Error(`Server not found: ${serverId}`);
    }

    if (!client.isConnected()) {
      throw new Error(`Server not connected: ${serverId}`);
    }

    return client.getPrompt(name, args);
  }

  /**
   * Find which server provides a specific prompt
   */
  async findPromptServer(promptName: string): Promise<MCPServerId | undefined> {
    for (const [id, client] of this.clients) {
      if (client.isConnected()) {
        try {
          const prompts = await client.listPrompts();
          if (prompts.some((prompt) => prompt.name === promptName)) {
            return id;
          }
        } catch {
          // Continue searching other servers
        }
      }
    }
    return undefined;
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  /**
   * Check health of all servers
   */
  async healthCheck(): Promise<Map<MCPServerId, boolean>> {
    const result = new Map<MCPServerId, boolean>();

    for (const [id, client] of this.clients) {
      try {
        const healthy = await client.ping();
        result.set(id, healthy);
      } catch {
        result.set(id, false);
      }
    }

    return result;
  }

  /**
   * Get status summary
   */
  getStatusSummary(): {
    total: number;
    connected: number;
    disconnected: number;
    error: number;
  } {
    let connected = 0;
    let disconnected = 0;
    let error = 0;

    for (const server of this.servers.values()) {
      switch (server.status) {
        case 'ready':
        case 'connected':
          connected++;
          break;
        case 'disconnected':
          disconnected++;
          break;
        case 'error':
          error++;
          break;
      }
    }

    return {
      total: this.servers.size,
      connected,
      disconnected,
      error,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Update server status
   */
  private updateServerStatus(
    id: MCPServerId,
    status: MCPServerConnectionStatus,
    error?: string
  ): void {
    const server = this.servers.get(id);
    if (server) {
      this.servers.set(id, {
        ...server,
        status,
        error,
        capabilities: this.clients.get(id)?.capabilities,
      });
      this.emit('serverStatusChange', { serverId: id, status, error });
    }
  }
}

/**
 * Create an MCP manager instance
 */
export function createMCPManager(): MCPManager {
  return new MCPManager();
}

// Singleton instance for convenience
let defaultManager: MCPManager | null = null;

/**
 * Get the default MCP manager instance
 */
export function getDefaultMCPManager(): MCPManager {
  if (!defaultManager) {
    defaultManager = new MCPManager();
  }
  return defaultManager;
}

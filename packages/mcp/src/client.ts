/**
 * MCP Client Implementation
 * Handles communication with MCP servers
 */

import { EventEmitter } from 'events';
import { StdioTransport, createTransport } from './transport.js';
import type {
  MCPServerId,
  MCPServerConfig,
  MCPServerConnectionStatus,
  MCPCapabilities,
  MCPServerInfo,
  MCPTool,
  MCPToolResult,
  MCPToolCallRequest,
  MCPResource,
  MCPResourceTemplate,
  MCPResourceReadResult,
  MCPPrompt,
  MCPPromptResult,
  MCPPromptGetRequest,
  MCPLogLevel,
  MCPMessage,
  MCPError,
  MCPErrorCodes,
  MCPEventType,
  MCPEventHandler,
  IMCPClient,
  ITransport,
} from './types.js';

/**
 * MCP Client
 * Manages connection and communication with a single MCP server
 */
export class MCPClient extends EventEmitter implements IMCPClient {
  readonly serverId: MCPServerId;
  readonly config: MCPServerConfig;
  
  private _status: MCPServerConnectionStatus = 'disconnected';
  private _capabilities: MCPCapabilities | undefined;
  private _serverInfo: MCPServerInfo | undefined;
  private _transport: ITransport | null = null;
  private _requestId = 0;
  private _pendingRequests: Map<string | number, {
    resolve: (value: MCPMessage) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = new Map();
  private _tools: MCPTool[] = [];
  private _resources: MCPResource[] = [];
  private _prompts: MCPPrompt[] = [];

  constructor(config: MCPServerConfig) {
    super();
    this.serverId = config.id;
    this.config = config;
  }

  /**
   * Current connection status
   */
  get status(): MCPServerConnectionStatus {
    return this._status;
  }

  /**
   * Server capabilities
   */
  get capabilities(): MCPCapabilities | undefined {
    return this._capabilities;
  }

  /**
   * Server information
   */
  get serverInfo(): MCPServerInfo | undefined {
    return this._serverInfo;
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this._status !== 'disconnected') {
      throw new Error(`Cannot connect: status is ${this._status}`);
    }

    this._status = 'connecting';
    this.emit('statusChange', this._status);

    try {
      // Create and setup transport
      const transportOptions = {
        timeout: this.config.timeout ?? 30000,
        retryAttempts: this.config.retryAttempts ?? 3,
        retryDelay: this.config.retryDelay ?? 1000,
      };
      this._transport = createTransport(this.config, transportOptions);

      // Setup message handler
      this._transport.onMessage((message) => this.handleMessage(message));
      
      // Setup error handler
      this._transport.onError((error) => {
        this.handleError(error);
      });

      // Setup close handler
      this._transport.onClose(() => {
        this.handleDisconnect();
      });

      // Connect transport (for stdio, this spawns the process)
      if (this._transport instanceof StdioTransport) {
        await this._transport.connect();
      }

      this._status = 'connected';
      this.emit('statusChange', this._status);

      // Initialize the MCP protocol
      await this.initialize();

    } catch (error) {
      this._status = 'error';
      this.emit('statusChange', this._status);
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this._status === 'disconnected') {
      return;
    }

    try {
      // Send shutdown notification if connected
      if (this._status === 'ready' && this._transport?.isConnected()) {
        try {
          await this.sendNotification('shutdown');
        } catch {
          // Ignore errors during shutdown
        }
      }

      // Close transport
      if (this._transport) {
        await this._transport.close();
        this._transport = null;
      }

    } finally {
      this.handleDisconnect();
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this._status === 'ready' && (this._transport?.isConnected() ?? false);
  }

  /**
   * Initialize the MCP protocol
   */
  async initialize(): Promise<MCPCapabilities> {
    if (this._status !== 'connected') {
      throw new Error('Must be connected before initializing');
    }

    this._status = 'initializing';
    this.emit('statusChange', this._status);

    try {
      // Send initialize request
      const response = await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        clientInfo: {
          name: 'spazzatura',
          version: '0.0.1',
        },
      });

      if (response.error) {
        throw new Error(`Initialize failed: ${response.error.message}`);
      }

      const result = response.result as {
        protocolVersion: string;
        capabilities: MCPCapabilities;
        serverInfo: MCPServerInfo;
      };

      this._capabilities = result.capabilities;
      this._serverInfo = result.serverInfo;

      // Send initialized notification
      await this.sendNotification('notifications/initialized');

      // Cache available tools, resources, and prompts
      await this.refreshCapabilities();

      this._status = 'ready';
      this.emit('statusChange', this._status);
      this.emit('connected');

      return this._capabilities;
    } catch (error) {
      this._status = 'error';
      this.emit('statusChange', this._status);
      throw error;
    }
  }

  /**
   * Ping the server
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.sendRequest('ping', {});
      return !response.error;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Tools API
  // ============================================================================

  /**
   * List available tools
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }

    const response = await this.sendRequest('tools/list', {});

    if (response.error) {
      throw new Error(`Failed to list tools: ${response.error.message}`);
    }

    const result = response.result as { tools: MCPTool[] };
    this._tools = result.tools || [];
    return this._tools;
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }

    const response = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });

    if (response.error) {
      return {
        content: [{ type: 'text', text: `Error: ${response.error.message}` }],
        isError: true,
      };
    }

    const result = response.result as MCPToolResult;
    return result;
  }

  // ============================================================================
  // Resources API
  // ============================================================================

  /**
   * List available resources
   */
  async listResources(): Promise<MCPResource[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }

    const response = await this.sendRequest('resources/list', {});

    if (response.error) {
      throw new Error(`Failed to list resources: ${response.error.message}`);
    }

    const result = response.result as { resources: MCPResource[] };
    this._resources = result.resources || [];
    return this._resources;
  }

  /**
   * List resource templates
   */
  async listResourceTemplates(): Promise<MCPResourceTemplate[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }

    const response = await this.sendRequest('resources/templates/list', {});

    if (response.error) {
      throw new Error(`Failed to list resource templates: ${response.error.message}`);
    }

    const result = response.result as { resourceTemplates: MCPResourceTemplate[] };
    return result.resourceTemplates || [];
  }

  /**
   * Read a resource
   */
  async readResource(uri: string): Promise<MCPResourceReadResult> {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }

    const response = await this.sendRequest('resources/read', { uri });

    if (response.error) {
      throw new Error(`Failed to read resource: ${response.error.message}`);
    }

    return response.result as MCPResourceReadResult;
  }

  /**
   * Subscribe to resource updates
   */
  async subscribeResource(uri: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }

    if (!this._capabilities?.resources?.subscribe) {
      throw new Error('Server does not support resource subscriptions');
    }

    const response = await this.sendRequest('resources/subscribe', { uri });

    if (response.error) {
      throw new Error(`Failed to subscribe to resource: ${response.error.message}`);
    }
  }

  /**
   * Unsubscribe from resource updates
   */
  async unsubscribeResource(uri: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }

    if (!this._capabilities?.resources?.subscribe) {
      throw new Error('Server does not support resource subscriptions');
    }

    const response = await this.sendRequest('resources/unsubscribe', { uri });

    if (response.error) {
      throw new Error(`Failed to unsubscribe from resource: ${response.error.message}`);
    }
  }

  // ============================================================================
  // Prompts API
  // ============================================================================

  /**
   * List available prompts
   */
  async listPrompts(): Promise<MCPPrompt[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }

    const response = await this.sendRequest('prompts/list', {});

    if (response.error) {
      throw new Error(`Failed to list prompts: ${response.error.message}`);
    }

    const result = response.result as { prompts: MCPPrompt[] };
    this._prompts = result.prompts || [];
    return this._prompts;
  }

  /**
   * Get a prompt
   */
  async getPrompt(name: string, args?: Record<string, string>): Promise<MCPPromptResult> {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }

    const response = await this.sendRequest('prompts/get', {
      name,
      arguments: args,
    });

    if (response.error) {
      throw new Error(`Failed to get prompt: ${response.error.message}`);
    }

    return response.result as MCPPromptResult;
  }

  // ============================================================================
  // Logging API
  // ============================================================================

  /**
   * Set log level
   */
  async setLogLevel(level: MCPLogLevel): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }

    const response = await this.sendRequest('logging/setLevel', { level });

    if (response.error) {
      throw new Error(`Failed to set log level: ${response.error.message}`);
    }
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Register event handler
   */
  override on(event: MCPEventType, handler: MCPEventHandler): this {
    return super.on(event, handler);
  }

  /**
   * Remove event handler
   */
  override off(event: MCPEventType, handler: MCPEventHandler): this {
    return super.off(event, handler);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Send a request and wait for response
   */
  private sendRequest(method: string, params: Record<string, unknown>): Promise<MCPMessage> {
    return new Promise((resolve, reject) => {
      if (!this._transport) {
        reject(new Error('Transport not initialized'));
        return;
      }

      const id = this.generateId();
      const message: MCPMessage = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      // Setup timeout
      const timeout = this.config.timeout || 30000;
      const timeoutId = setTimeout(() => {
        this._pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeout);

      // Store pending request
      this._pendingRequests.set(id, {
        resolve: (response) => {
          clearTimeout(timeoutId);
          this._pendingRequests.delete(id);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          this._pendingRequests.delete(id);
          reject(error);
        },
        timeout: timeoutId,
      });

      // Send message
      this._transport.send(message).catch(reject);
    });
  }

  /**
   * Send a notification (no response expected)
   */
  private async sendNotification(method: string, params?: Record<string, unknown>): Promise<void> {
    if (!this._transport) {
      throw new Error('Transport not initialized');
    }

    const message: MCPMessage = {
      jsonrpc: '2.0',
      method,
      ...(params !== undefined && { params }),
    };

    await this._transport.send(message);
  }

  /**
   * Generate unique request ID
   */
  private generateId(): number {
    return ++this._requestId;
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: MCPMessage): void {
    // Handle response to a request
    if (message.id !== undefined) {
      const pending = this._pendingRequests.get(message.id);
      if (pending) {
        pending.resolve(message);
      }
      return;
    }

    // Handle notification
    if (message.method) {
      this.handleNotification(message.method, message.params);
    }
  }

  /**
   * Handle server notification
   */
  private handleNotification(method: string, params?: Record<string, unknown>): void {
    switch (method) {
      case 'notifications/tools/list_changed':
        this.emit('toolsChanged', { serverId: this.serverId });
        this.listTools().catch(() => {});
        break;

      case 'notifications/resources/list_changed':
        this.emit('resourcesChanged', { serverId: this.serverId });
        this.listResources().catch(() => {});
        break;

      case 'notifications/resources/updated':
        if (params?.uri) {
          this.emit('resourceUpdated', {
            serverId: this.serverId,
            uri: params.uri as string,
          });
        }
        break;

      case 'notifications/prompts/list_changed':
        this.emit('promptsChanged', { serverId: this.serverId });
        this.listPrompts().catch(() => {});
        break;

      case 'notifications/message':
      case 'logging':
        this.emit('log', params);
        break;

      default:
        this.emit('notification', { method, params });
    }
  }

  /**
   * Handle error
   */
  private handleError(error: Error): void {
    this.emit('error', error);
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(): void {
    // Reject all pending requests
    for (const [id, pending] of this._pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    this._pendingRequests.clear();

    this._status = 'disconnected';
    this._transport = null;
    // Reset capabilities by assigning empty objects (will be overwritten on reconnect)
    this._capabilities = undefined as MCPCapabilities | undefined;
    this._serverInfo = undefined as MCPServerInfo | undefined;
    this._tools = [];
    this._resources = [];
    this._prompts = [];

    this.emit('statusChange', this._status);
    this.emit('disconnected');
  }

  /**
   * Refresh cached capabilities
   */
  private async refreshCapabilities(): Promise<void> {
    try {
      if (this._capabilities?.tools) {
        await this.listTools();
      }
      if (this._capabilities?.resources) {
        await this.listResources();
      }
      if (this._capabilities?.prompts) {
        await this.listPrompts();
      }
    } catch (error) {
      // Ignore errors during refresh
    }
  }
}

/**
 * Create an MCP client
 */
export function createMCPClient(config: MCPServerConfig): MCPClient {
  return new MCPClient(config);
}

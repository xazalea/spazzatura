/**
 * MCP (Model Context Protocol) types
 */

/**
 * MCP server identifier
 */
export type MCPServerId = string;

/**
 * MCP transport type
 */
export type MCPTransport = 'stdio' | 'http' | 'websocket';

/**
 * MCP resource type
 */
export type MCPResourceType = 'file' | 'database' | 'api' | 'custom';

/**
 * MCP tool definition
 */
export interface MCPTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

/**
 * MCP resource definition
 */
export interface MCPResource {
  readonly uri: string;
  readonly name: string;
  readonly description?: string;
  readonly mimeType?: string;
}

/**
 * MCP prompt definition
 */
export interface MCPPrompt {
  readonly name: string;
  readonly description?: string;
  readonly arguments?: readonly MCPPromptArgument[];
}

/**
 * MCP prompt argument
 */
export interface MCPPromptArgument {
  readonly name: string;
  readonly description?: string;
  readonly required: boolean;
}

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  readonly id: MCPServerId;
  readonly name: string;
  readonly transport: MCPTransport;
  readonly command?: string;
  readonly args?: readonly string[];
  readonly url?: string;
  readonly env?: Record<string, string>;
  readonly timeout?: number;
  readonly retryAttempts?: number;
}

/**
 * MCP server status
 */
export interface MCPServerStatus {
  readonly id: MCPServerId;
  readonly connected: boolean;
  readonly lastPing?: Date;
  readonly error?: string;
  readonly tools: readonly MCPTool[];
  readonly resources: readonly MCPResource[];
  readonly prompts: readonly MCPPrompt[];
}

/**
 * MCP tool call request
 */
export interface MCPToolCallRequest {
  readonly serverId: MCPServerId;
  readonly toolName: string;
  readonly arguments: Record<string, unknown>;
}

/**
 * MCP tool call response
 */
export interface MCPToolCallResponse {
  readonly content: readonly MCPContent[];
  readonly isError?: boolean;
}

/**
 * MCP content block
 */
export interface MCPContent {
  readonly type: 'text' | 'image' | 'resource';
  readonly text?: string;
  readonly data?: string;
  readonly mimeType?: string;
  readonly resourceUri?: string;
}

/**
 * MCP resource read request
 */
export interface MCPResourceRequest {
  readonly serverId: MCPServerId;
  readonly uri: string;
}

/**
 * MCP resource read response
 */
export interface MCPResourceResponse {
  readonly contents: readonly MCPResourceContent[];
}

/**
 * MCP resource content
 */
export interface MCPResourceContent {
  readonly uri: string;
  readonly mimeType?: string;
  readonly text?: string;
  readonly blob?: string;
}

/**
 * MCP prompt get request
 */
export interface MCPPromptRequest {
  readonly serverId: MCPServerId;
  readonly name: string;
  readonly arguments?: Record<string, string>;
}

/**
 * MCP prompt response
 */
export interface MCPPromptResponse {
  readonly description?: string;
  readonly messages: readonly MCPPromptMessage[];
}

/**
 * MCP prompt message
 */
export interface MCPPromptMessage {
  readonly role: 'user' | 'assistant';
  readonly content: MCPContent;
}

/**
 * MCP manager interface
 */
export interface IMCPManager {
  connect(config: MCPServerConfig): Promise<void>;
  disconnect(serverId: MCPServerId): Promise<void>;
  getStatus(serverId: MCPServerId): MCPServerStatus | undefined;
  listServers(): readonly MCPServerId[];
  callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse>;
  readResource(request: MCPResourceRequest): Promise<MCPResourceResponse>;
  getPrompt(request: MCPPromptRequest): Promise<MCPPromptResponse>;
}

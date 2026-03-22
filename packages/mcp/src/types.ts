/**
 * MCP (Model Context Protocol) Types
 * Based on the MCP specification for external tool servers
 */

// ============================================================================
// JSON-RPC 2.0 Base Types
// ============================================================================

/**
 * JSON-RPC 2.0 message structure
 */
export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: MCPError;
}

/**
 * JSON-RPC 2.0 error object
 */
export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * Standard JSON-RPC error codes
 */
export const MCPErrorCodes = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  // Server error codes (-32000 to -32099)
  ServerNotInitialized: -32002,
  ConnectionClosed: -32001,
} as const;

// ============================================================================
// Server Configuration Types
// ============================================================================

/**
 * MCP server identifier
 */
export type MCPServerId = string;

/**
 * MCP transport type
 */
export type MCPTransportType = 'stdio' | 'sse' | 'websocket';

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  /** Unique identifier for the server */
  readonly id: MCPServerId;
  /** Human-readable name */
  readonly name: string;
  /** Transport type */
  readonly transport: MCPTransportType;
  /** Command to execute (for stdio transport) */
  readonly command?: string;
  /** Command arguments (for stdio transport) */
  readonly args?: readonly string[];
  /** URL endpoint (for SSE/WebSocket transport) */
  readonly url?: string;
  /** Environment variables */
  readonly env?: Record<string, string>;
  /** Working directory */
  readonly cwd?: string;
  /** Connection timeout in milliseconds */
  readonly timeout?: number;
  /** Whether the server is disabled */
  readonly disabled?: boolean;
  /** Number of retry attempts on connection failure */
  readonly retryAttempts?: number;
  /** Delay between retry attempts in milliseconds */
  readonly retryDelay?: number;
}

/**
 * MCP server state
 */
export interface MCPServer {
  /** Server identifier */
  readonly id: MCPServerId;
  /** Server configuration */
  readonly config: MCPServerConfig;
  /** Connection status */
  readonly status: MCPServerConnectionStatus;
  /** Server capabilities (after initialization) */
  readonly capabilities: MCPCapabilities | undefined;
  /** Server information */
  readonly serverInfo: MCPServerInfo | undefined;
  /** Last error message */
  readonly error: string | undefined;
  /** Last ping timestamp */
  readonly lastPing: Date | undefined;
}

/**
 * Server connection status
 */
export type MCPServerConnectionStatus = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'initializing'
  | 'ready'
  | 'error';

/**
 * Server information returned during initialization
 */
export interface MCPServerInfo {
  readonly name: string;
  readonly version: string;
  readonly protocolVersion: string;
}

// ============================================================================
// Capability Types
// ============================================================================

/**
 * MCP server capabilities
 */
export interface MCPCapabilities {
  /** Tool capabilities */
  readonly tools?: MCPToolCapabilities;
  /** Resource capabilities */
  readonly resources?: MCPResourceCapabilities;
  /** Prompt capabilities */
  readonly prompts?: MCPPromptCapabilities;
  /** Logging capabilities */
  readonly logging?: MCPCapability;
  /** Experimental capabilities */
  readonly experimental?: Record<string, unknown>;
}

/**
 * Base capability marker
 */
export interface MCPCapability {
  readonly [key: string]: unknown;
}

/**
 * Tool capabilities
 */
export interface MCPToolCapabilities extends MCPCapability {
  /** Supports listChanged notifications */
  readonly listChanged?: boolean;
}

/**
 * Resource capabilities
 */
export interface MCPResourceCapabilities extends MCPCapability {
  /** Supports subscribe/unsubscribe */
  readonly subscribe?: boolean;
  /** Supports listChanged notifications */
  readonly listChanged?: boolean;
}

/**
 * Prompt capabilities
 */
export interface MCPPromptCapabilities extends MCPCapability {
  /** Supports listChanged notifications */
  readonly listChanged?: boolean;
}

// ============================================================================
// Tool Types
// ============================================================================

/**
 * MCP tool definition
 */
export interface MCPTool {
  /** Tool name */
  readonly name: string;
  /** Tool description */
  readonly description: string;
  /** JSON Schema for input parameters */
  readonly inputSchema: MCPInputSchema;
}

/**
 * JSON Schema for tool input
 */
export interface MCPInputSchema {
  readonly type: 'object';
  readonly properties?: Record<string, MCPPropertySchema>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
}

/**
 * JSON Schema property definition
 */
export interface MCPPropertySchema {
  readonly type: string;
  readonly description?: string;
  readonly enum?: readonly string[];
  readonly default?: unknown;
  readonly items?: MCPPropertySchema;
  readonly properties?: Record<string, MCPPropertySchema>;
  readonly required?: readonly string[];
}

/**
 * Tool call request
 */
export interface MCPToolCallRequest {
  /** Tool name to call */
  readonly name: string;
  /** Arguments to pass to the tool */
  readonly arguments: Record<string, unknown>;
}

/**
 * Tool call result
 */
export interface MCPToolResult {
  /** Content blocks */
  readonly content: readonly MCPContentBlock[];
  /** Whether the call resulted in an error */
  readonly isError?: boolean;
}

// ============================================================================
// Content Types
// ============================================================================

/**
 * Content block types
 */
export type MCPContentBlock = 
  | MCPTextContent
  | MCPImageContent
  | MCPResourceContent;

/**
 * Text content block
 */
export interface MCPTextContent {
  readonly type: 'text';
  readonly text: string;
}

/**
 * Image content block
 */
export interface MCPImageContent {
  readonly type: 'image';
  readonly data: string;
  readonly mimeType: string;
}

/**
 * Resource reference content block
 */
export interface MCPResourceContent {
  readonly type: 'resource';
  readonly resource: MCPResourceReference;
}

/**
 * Resource reference
 */
export interface MCPResourceReference {
  readonly uri: string;
  readonly mimeType?: string;
  readonly text?: string;
  readonly blob?: string;
}

// ============================================================================
// Resource Types
// ============================================================================

/**
 * MCP resource definition
 */
export interface MCPResource {
  /** Resource URI */
  readonly uri: string;
  /** Human-readable name */
  readonly name: string;
  /** Resource description */
  readonly description?: string;
  /** MIME type */
  readonly mimeType?: string;
}

/**
 * Resource template for parameterized resources
 */
export interface MCPResourceTemplate {
  /** URI template (RFC 6570) */
  readonly uriTemplate: string;
  /** Human-readable name */
  readonly name: string;
  /** Template description */
  readonly description?: string;
  /** MIME type */
  readonly mimeType?: string;
}

/**
 * Resource read result
 */
export interface MCPResourceReadResult {
  /** Resource contents */
  readonly contents: readonly MCPResourceContents[];
}

/**
 * Resource contents
 */
export interface MCPResourceContents {
  /** Resource URI */
  readonly uri: string;
  /** MIME type */
  readonly mimeType?: string;
  /** Text content (for text resources) */
  readonly text?: string;
  /** Base64-encoded binary content */
  readonly blob?: string;
}

/**
 * Resource subscription
 */
export interface MCPResourceSubscription {
  /** Subscribed URI */
  readonly uri: string;
  /** Subscription timestamp */
  readonly subscribedAt: Date;
}

// ============================================================================
// Prompt Types
// ============================================================================

/**
 * MCP prompt definition
 */
export interface MCPPrompt {
  /** Prompt name */
  readonly name: string;
  /** Prompt description */
  readonly description?: string;
  /** Prompt arguments */
  readonly arguments?: readonly MCPPromptArgument[];
}

/**
 * Prompt argument definition
 */
export interface MCPPromptArgument {
  /** Argument name */
  readonly name: string;
  /** Argument description */
  readonly description?: string;
  /** Whether the argument is required */
  readonly required?: boolean;
}

/**
 * Prompt get request
 */
export interface MCPPromptGetRequest {
  /** Prompt name */
  readonly name: string;
  /** Argument values */
  readonly arguments?: Record<string, string>;
}

/**
 * Prompt get result
 */
export interface MCPPromptResult {
  /** Prompt description */
  readonly description?: string;
  /** Prompt messages */
  readonly messages: readonly MCPPromptMessage[];
}

/**
 * Prompt message
 */
export interface MCPPromptMessage {
  /** Message role */
  readonly role: 'user' | 'assistant';
  /** Message content */
  readonly content: MCPContentBlock;
}

// ============================================================================
// Logging Types
// ============================================================================

/**
 * Log level
 */
export type MCPLogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

/**
 * Log message
 */
export interface MCPLogMessage {
  /** Log level */
  readonly level: MCPLogLevel;
  /** Logger name */
  readonly logger?: string;
  /** Log data */
  readonly data: unknown;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * MCP event types
 */
export type MCPEventType = 
  | 'toolsChanged'
  | 'resourcesChanged'
  | 'promptsChanged'
  | 'resourceUpdated'
  | 'log'
  | 'error'
  | 'connected'
  | 'disconnected';

/**
 * MCP event handler
 */
export type MCPEventHandler<T = unknown> = (data: T) => void;

/**
 * Tools changed event
 */
export interface MCPToolsChangedEvent {
  readonly serverId: MCPServerId;
}

/**
 * Resources changed event
 */
export interface MCPResourcesChangedEvent {
  readonly serverId: MCPServerId;
}

/**
 * Prompts changed event
 */
export interface MCPPromptsChangedEvent {
  readonly serverId: MCPServerId;
}

/**
 * Resource updated event
 */
export interface MCPResourceUpdatedEvent {
  readonly serverId: MCPServerId;
  readonly uri: string;
}

// ============================================================================
// Transport Types
// ============================================================================

/**
 * Transport interface
 */
export interface ITransport {
  /** Send a message */
  send(message: MCPMessage): Promise<void>;
  /** Register message handler */
  onMessage(handler: (message: MCPMessage) => void): void;
  /** Register error handler */
  onError(handler: (error: Error) => void): void;
  /** Register close handler */
  onClose(handler: () => void): void;
  /** Close the transport */
  close(): Promise<void>;
  /** Check if transport is connected */
  isConnected(): boolean;
}

/**
 * Transport connection options
 */
export interface TransportOptions {
  /** Connection timeout in milliseconds */
  readonly timeout?: number;
  /** Retry attempts */
  readonly retryAttempts?: number;
  /** Retry delay in milliseconds */
  readonly retryDelay?: number;
}

// ============================================================================
// Manager Types
// ============================================================================

/**
 * MCP manager interface
 */
export interface IMCPManager {
  /** Connected servers */
  readonly servers: Map<MCPServerId, MCPServer>;
  /** Connected clients */
  readonly clients: Map<MCPServerId, MCPClient>;

  // Server Management
  addServer(config: MCPServerConfig): Promise<MCPServer>;
  removeServer(id: MCPServerId): Promise<void>;
  getServer(id: MCPServerId): MCPServer | undefined;
  listServers(): MCPServer[];

  // Connection Management
  connect(id: MCPServerId): Promise<void>;
  disconnect(id: MCPServerId): Promise<void>;
  connectAll(): Promise<void>;
  disconnectAll(): Promise<void>;

  // Tool Aggregation
  listAllTools(): Promise<Map<MCPServerId, MCPTool[]>>;
  callTool(serverId: MCPServerId, toolName: string, args: Record<string, unknown>): Promise<MCPToolResult>;

  // Resource Aggregation
  listAllResources(): Promise<Map<MCPServerId, MCPResource[]>>;
  readResource(serverId: MCPServerId, uri: string): Promise<MCPResourceReadResult>;

  // Prompt Aggregation
  listAllPrompts(): Promise<Map<MCPServerId, MCPPrompt[]>>;
  getPrompt(serverId: MCPServerId, name: string, args?: Record<string, string>): Promise<MCPPromptResult>;

  // Health Check
  healthCheck(): Promise<Map<MCPServerId, boolean>>;
}

/**
 * MCP client interface
 */
export interface IMCPClient {
  /** Server ID */
  readonly serverId: MCPServerId;
  /** Server configuration */
  readonly config: MCPServerConfig;
  /** Connection status */
  readonly status: MCPServerConnectionStatus;
  /** Server capabilities (available after initialization) */
  readonly capabilities: MCPCapabilities | undefined;

  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Initialization
  initialize(): Promise<MCPCapabilities>;
  ping(): Promise<boolean>;

  // Tools
  listTools(): Promise<MCPTool[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult>;

  // Resources
  listResources(): Promise<MCPResource[]>;
  listResourceTemplates(): Promise<MCPResourceTemplate[]>;
  readResource(uri: string): Promise<MCPResourceReadResult>;
  subscribeResource?(uri: string): Promise<void>;
  unsubscribeResource?(uri: string): Promise<void>;

  // Prompts
  listPrompts(): Promise<MCPPrompt[]>;
  getPrompt(name: string, args?: Record<string, string>): Promise<MCPPromptResult>;

  // Logging
  setLogLevel(level: MCPLogLevel): Promise<void>;

  // Events
  on(event: MCPEventType, handler: MCPEventHandler): void;
  off(event: MCPEventType, handler: MCPEventHandler): void;
}

// Type alias for the client interface
export type MCPClient = IMCPClient;

// ============================================================================
// Registry Types
// ============================================================================

/**
 * MCP server package metadata
 */
export interface MCPServerPackage {
  /** Package name */
  readonly name: string;
  /** Package version */
  readonly version: string;
  /** Package description */
  readonly description: string;
  /** NPM package name */
  readonly npmPackage: string;
  /** Required environment variables */
  readonly envVars?: readonly string[];
  /** Default configuration */
  readonly defaultConfig?: Partial<MCPServerConfig>;
  /** Installation command */
  readonly installCommand?: string;
}

/**
 * MCP server template
 */
export interface MCPServerTemplate {
  /** Template ID */
  readonly id: string;
  /** Template name */
  readonly name: string;
  /** Template description */
  readonly description: string;
  /** Generate configuration from template */
  generateConfig(options?: Record<string, unknown>): MCPServerConfig;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * MCP configuration file format
 */
export interface MCPConfigFile {
  /** MCP servers configuration */
  readonly mcpServers?: Record<string, MCPServerConfigEntry>;
}

/**
 * Server configuration entry in config file
 */
export interface MCPServerConfigEntry {
  /** Command to execute */
  readonly command: string;
  /** Command arguments */
  readonly args?: readonly string[];
  /** Environment variables */
  readonly env?: Record<string, string>;
  /** Working directory */
  readonly cwd?: string;
  /** Timeout in milliseconds */
  readonly timeout?: number;
  /** Whether disabled */
  readonly disabled?: boolean;
}

/**
 * Configuration validation result
 */
export interface MCPConfigValidationResult {
  /** Whether configuration is valid */
  readonly valid: boolean;
  /** Validation errors */
  readonly errors: readonly string[];
  /** Validation warnings */
  readonly warnings: readonly string[];
}

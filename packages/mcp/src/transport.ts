/**
 * MCP Transport Layer
 * Implements communication protocols for MCP servers
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import type {
  MCPMessage,
  MCPServerConfig,
  ITransport,
  TransportOptions,
} from './types.js';

/**
 * Base transport implementation with common functionality
 */
export abstract class BaseTransport extends EventEmitter implements ITransport {
  protected _connected = false;
  protected messageHandler?: (message: MCPMessage) => void;
  protected errorHandler?: (error: Error) => void;
  protected closeHandler?: () => void;
  protected options: TransportOptions;

  constructor(options: TransportOptions = {}) {
    super();
    this.options = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...options,
    };
  }

  abstract send(message: MCPMessage): Promise<void>;
  abstract close(): Promise<void>;

  isConnected(): boolean {
    return this._connected;
  }

  onMessage(handler: (message: MCPMessage) => void): void {
    this.messageHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  protected handleMessage(message: MCPMessage): void {
    if (this.messageHandler) {
      this.messageHandler(message);
    }
  }

  protected handleError(error: Error): void {
    if (this.errorHandler) {
      this.errorHandler(error);
    }
    this.emit('error', error);
  }

  protected handleClose(): void {
    this._connected = false;
    if (this.closeHandler) {
      this.closeHandler();
    }
    this.emit('close');
  }

  protected async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Stdio Transport
 * Communicates with MCP servers via stdin/stdout
 */
export class StdioTransport extends BaseTransport implements ITransport {
  private process: ChildProcess | null = null;
  private buffer = '';
  private config: MCPServerConfig;
  private messageId = 0;

  constructor(config: MCPServerConfig, options?: TransportOptions) {
    super(options);
    this.config = config;
  }

  /**
   * Start the MCP server process and establish communication
   */
  async connect(): Promise<void> {
    if (this._connected) {
      throw new Error('Transport already connected');
    }

    if (!this.config.command) {
      throw new Error('Command is required for stdio transport');
    }

    return new Promise((resolve, reject) => {
      const timeout = this.options.timeout || 30000;
      const timeoutId = setTimeout(() => {
        reject(new Error(`Connection timeout after ${timeout}ms`));
        this.cleanup();
      }, timeout);

      try {
        // Spawn the MCP server process
        this.process = spawn(
          this.config.command!,
          this.config.args || [],
          {
            cwd: this.config.cwd,
            env: {
              ...process.env,
              ...this.config.env,
            },
            stdio: ['pipe', 'pipe', 'pipe'],
          }
        );

        // Handle process errors
        this.process.on('error', (error) => {
          clearTimeout(timeoutId);
          this.handleError(new Error(`Process error: ${error.message}`));
          reject(error);
        });

        // Handle process exit
        this.process.on('exit', (code, signal) => {
          clearTimeout(timeoutId);
          if (this._connected) {
            this.handleClose();
          }
          if (code !== 0 && code !== null) {
            this.handleError(new Error(`Process exited with code ${code}`));
          }
        });

        // Handle stdout (messages from server)
        this.process.stdout?.on('data', (data: Buffer) => {
          this.handleData(data.toString());
        });

        // Handle stderr (logs/errors)
        this.process.stderr?.on('data', (data: Buffer) => {
          this.emit('log', data.toString());
        });

        // Connection established
        this._connected = true;
        clearTimeout(timeoutId);
        this.emit('connected');
        resolve();
      } catch (error) {
        clearTimeout(timeoutId);
        this.cleanup();
        reject(error);
      }
    });
  }

  /**
   * Send a message to the server
   */
  async send(message: MCPMessage): Promise<void> {
    if (!this._connected || !this.process?.stdin) {
      throw new Error('Transport not connected');
    }

    return new Promise((resolve, reject) => {
      try {
        const messageStr = JSON.stringify(message) + '\n';
        this.process!.stdin!.write(messageStr, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Close the transport and terminate the process
   */
  async close(): Promise<void> {
    if (!this._connected) {
      return;
    }

    this.cleanup();
    this.handleClose();
  }

  /**
   * Generate a unique message ID
   */
  generateId(): number {
    return ++this.messageId;
  }

  /**
   * Handle incoming data and parse messages
   */
  private handleData(data: string): void {
    this.buffer += data;

    // Process complete messages (newline-delimited JSON)
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (line) {
        try {
          const message = JSON.parse(line) as MCPMessage;
          this.handleMessage(message);
        } catch (error) {
          this.handleError(new Error(`Failed to parse message: ${line}`));
        }
      }
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this._connected = false;
    if (this.process) {
      try {
        this.process.kill('SIGTERM');
      } catch {
        // Ignore errors during cleanup
      }
      this.process = null;
    }
    this.buffer = '';
  }
}

/**
 * SSE (Server-Sent Events) Transport
 * Communicates with MCP servers via HTTP SSE
 */
export class SSETransport extends BaseTransport implements ITransport {
  private url: string;
  private eventSource: EventSource | null = null;
  private messageId = 0;
  private pendingRequests: Map<string | number, {
    resolve: (value: MCPMessage) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = new Map();

  constructor(url: string, options?: TransportOptions) {
    super(options);
    this.url = url;
  }

  /**
   * Connect to the SSE endpoint
   */
  async connect(): Promise<void> {
    if (this._connected) {
      throw new Error('Transport already connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = this.options.timeout || 30000;
      const timeoutId = setTimeout(() => {
        reject(new Error(`Connection timeout after ${timeout}ms`));
        this.cleanup();
      }, timeout);

      try {
        // Note: In Node.js, we'd use a polyfill or native fetch with SSE
        // This is a conceptual implementation
        this.eventSource = new EventSource(this.url);

        this.eventSource.onopen = () => {
          clearTimeout(timeoutId);
          this._connected = true;
          this.emit('connected');
          resolve();
        };

        this.eventSource.onerror = (error) => {
          clearTimeout(timeoutId);
          if (!this._connected) {
            reject(new Error('Failed to connect to SSE endpoint'));
          } else {
            this.handleError(new Error('SSE connection error'));
          }
        };

        this.eventSource.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as MCPMessage;
            this.handleMessage(message);
          } catch (error) {
            this.handleError(new Error(`Failed to parse SSE message: ${event.data}`));
          }
        };
      } catch (error) {
        clearTimeout(timeoutId);
        this.cleanup();
        reject(error);
      }
    });
  }

  /**
   * Send a message via HTTP POST
   */
  async send(message: MCPMessage): Promise<void> {
    if (!this._connected) {
      throw new Error('Transport not connected');
    }

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      // Handle response if it contains a message
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const responseMessage = await response.json() as MCPMessage;
        this.handleMessage(responseMessage);
      }
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Close the SSE connection
   */
  async close(): Promise<void> {
    if (!this._connected) {
      return;
    }

    this.cleanup();
    this.handleClose();
  }

  /**
   * Generate a unique message ID
   */
  generateId(): number {
    return ++this.messageId;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this._connected = false;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }
}

/**
 * WebSocket Transport
 * Communicates with MCP servers via WebSocket
 */
export class WebSocketTransport extends BaseTransport implements ITransport {
  private url: string;
  private ws: WebSocket | null = null;
  private messageId = 0;
  private pendingRequests: Map<string | number, {
    resolve: (value: MCPMessage) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = new Map();

  constructor(url: string, options?: TransportOptions) {
    super(options);
    this.url = url;
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this._connected) {
      throw new Error('Transport already connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = this.options.timeout || 30000;
      const timeoutId = setTimeout(() => {
        reject(new Error(`Connection timeout after ${timeout}ms`));
        this.cleanup();
      }, timeout);

      try {
        // Note: In Node.js, we'd use the 'ws' library
        // This is a conceptual implementation using the browser WebSocket API
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          clearTimeout(timeoutId);
          this._connected = true;
          this.emit('connected');
          resolve();
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeoutId);
          if (!this._connected) {
            reject(new Error('Failed to connect to WebSocket'));
          } else {
            this.handleError(new Error('WebSocket error'));
          }
        };

        this.ws.onclose = () => {
          if (this._connected) {
            this.handleClose();
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data as string) as MCPMessage;
            this.handleMessage(message);
          } catch (error) {
            this.handleError(new Error(`Failed to parse WebSocket message`));
          }
        };
      } catch (error) {
        clearTimeout(timeoutId);
        this.cleanup();
        reject(error);
      }
    });
  }

  /**
   * Send a message via WebSocket
   */
  async send(message: MCPMessage): Promise<void> {
    if (!this._connected || !this.ws) {
      throw new Error('Transport not connected');
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Close the WebSocket connection
   */
  async close(): Promise<void> {
    if (!this._connected) {
      return;
    }

    this.cleanup();
    this.handleClose();
  }

  /**
   * Generate a unique message ID
   */
  generateId(): number {
    return ++this.messageId;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this._connected = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }
}

/**
 * Create a transport instance based on configuration
 */
export function createTransport(config: MCPServerConfig, options?: TransportOptions): ITransport {
  switch (config.transport) {
    case 'stdio':
      return new StdioTransport(config, options);
    case 'sse':
      if (!config.url) {
        throw new Error('URL is required for SSE transport');
      }
      return new SSETransport(config.url, options);
    case 'websocket':
      if (!config.url) {
        throw new Error('URL is required for WebSocket transport');
      }
      return new WebSocketTransport(config.url, options);
    default:
      throw new Error(`Unknown transport type: ${(config as any).transport}`);
  }
}

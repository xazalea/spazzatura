/**
 * Tool execution engine
 * Handles parameter validation, timeout, error recovery, and result caching
 */

import type { Tool, ToolResult, JSONSchema } from './types.js';

/**
 * Executor configuration
 */
export interface ExecutorConfig {
  /** Default timeout for tool execution in milliseconds */
  readonly defaultTimeout?: number;
  /** Enable result caching */
  readonly enableCache?: boolean;
  /** Cache TTL in milliseconds */
  readonly cacheTtl?: number;
  /** Maximum cache size */
  readonly maxCacheSize?: number;
  /** Maximum retries for failed executions */
  readonly maxRetries?: number;
  /** Retry delay in milliseconds */
  readonly retryDelay?: number;
}

/**
 * Execution context
 */
export interface ExecutionContext {
  /** Tool name */
  readonly toolName: string;
  /** Parameters passed to the tool */
  readonly params: Record<string, unknown>;
  /** Execution start time */
  readonly startTime: Date;
  /** Timeout for this execution */
  readonly timeout: number;
  /** Retry count */
  readonly retryCount: number;
}

/**
 * Cached result entry
 */
interface CacheEntry {
  readonly result: ToolResult;
  readonly timestamp: number;
}

/**
 * Tool executor with validation, timeout, caching, and retry support
 */
export class ToolExecutor {
  private readonly defaultTimeout: number;
  private readonly enableCache: boolean;
  private readonly cacheTtl: number;
  private readonly maxCacheSize: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly tools: Map<string, Tool> = new Map();

  constructor(config: ExecutorConfig = {}) {
    this.defaultTimeout = config.defaultTimeout ?? 30000;
    this.enableCache = config.enableCache ?? true;
    this.cacheTtl = config.cacheTtl ?? 60000; // 1 minute
    this.maxCacheSize = config.maxCacheSize ?? 100;
    this.maxRetries = config.maxRetries ?? 0;
    this.retryDelay = config.retryDelay ?? 1000;
  }

  /**
   * Register a tool
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): void {
    this.tools.delete(name);
  }

  /**
   * Get a registered tool
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all registered tools
   */
  listTools(): readonly Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Execute a tool with validation, timeout, and caching
   */
  async execute(
    toolName: string,
    params: Record<string, unknown>,
    options?: {
      timeout?: number;
      skipCache?: boolean;
      retries?: number;
    }
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        output: null,
        error: `Tool not found: ${toolName}`,
      };
    }

    // Validate parameters
    const validation = this.validateParams(tool, params);
    if (!validation.valid) {
      return {
        success: false,
        output: null,
        error: `Parameter validation failed: ${validation.error}`,
      };
    }

    // Check cache
    if (this.enableCache && !options?.skipCache) {
      const cacheKey = this.getCacheKey(toolName, params);
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Execute with timeout and retries
    const timeout = options?.timeout ?? this.defaultTimeout;
    const maxRetries = options?.retries ?? this.maxRetries;

    let lastError: string | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeWithTimeout(tool, params, timeout);

        // Cache successful results
        if (this.enableCache && result.success) {
          const cacheKey = this.getCacheKey(toolName, params);
          this.setCachedResult(cacheKey, result);
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);

        // Wait before retry
        if (attempt < maxRetries) {
          await this.delay(this.retryDelay * (attempt + 1));
        }
      }
    }

    return {
      success: false,
      output: null,
      error: lastError ?? 'Execution failed',
    };
  }

  /**
   * Execute a tool with timeout
   */
  private async executeWithTimeout(
    tool: Tool,
    params: Record<string, unknown>,
    timeout: number
  ): Promise<ToolResult> {
    return new Promise<ToolResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeout}ms`));
      }, timeout);

      tool.execute(params)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Validate parameters against tool schema
   */
  private validateParams(
    tool: Tool,
    params: Record<string, unknown>
  ): { valid: boolean; error?: string } {
    const schema = tool.parameters;

    // Check required properties
    if (schema.required) {
      for (const required of schema.required) {
        if (!(required in params)) {
          return {
            valid: false,
            error: `Missing required parameter: ${required}`,
          };
        }
      }
    }

    // Validate property types
    if (schema.properties) {
      for (const [key, value] of Object.entries(params)) {
        const propSchema = schema.properties[key];
        if (propSchema) {
          const typeValidation = this.validateType(value, propSchema, key);
          if (!typeValidation.valid) {
            return typeValidation;
          }
        }
      }
    }

    return { valid: true };
  }

  /**
   * Validate a value against a JSON schema
   */
  private validateType(
    value: unknown,
    schema: JSONSchema,
    path: string
  ): { valid: boolean; error?: string } {
    if (value === undefined || value === null) {
      return { valid: true };
    }

    const expectedType = schema.type;

    switch (expectedType) {
      case 'string':
        if (typeof value !== 'string') {
          return { valid: false, error: `${path} must be a string` };
        }
        if (schema.enum && !schema.enum.includes(value)) {
          return {
            valid: false,
            error: `${path} must be one of: ${schema.enum.join(', ')}`,
          };
        }
        break;

      case 'number':
      case 'integer':
        if (typeof value !== 'number') {
          return { valid: false, error: `${path} must be a number` };
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return { valid: false, error: `${path} must be a boolean` };
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          return { valid: false, error: `${path} must be an array` };
        }
        if (schema.items) {
          for (let i = 0; i < value.length; i++) {
            const itemValidation = this.validateType(
              value[i],
              schema.items,
              `${path}[${i}]`
            );
            if (!itemValidation.valid) {
              return itemValidation;
            }
          }
        }
        break;

      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          return { valid: false, error: `${path} must be an object` };
        }
        break;
    }

    return { valid: true };
  }

  /**
   * Generate a cache key
   */
  private getCacheKey(toolName: string, params: Record<string, unknown>): string {
    return `${toolName}:${JSON.stringify(params)}`;
  }

  /**
   * Get a cached result
   */
  private getCachedResult(cacheKey: string): ToolResult | undefined {
    const entry = this.cache.get(cacheKey);
    if (!entry) {
      return undefined;
    }

    // Check if cache entry is expired
    if (Date.now() - entry.timestamp > this.cacheTtl) {
      this.cache.delete(cacheKey);
      return undefined;
    }

    return entry.result;
  }

  /**
   * Set a cached result
   */
  private setCachedResult(cacheKey: string, result: ToolResult): void {
    // Evict old entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a tool executor with optional configuration
 */
export function createToolExecutor(config?: ExecutorConfig): ToolExecutor {
  return new ToolExecutor(config);
}

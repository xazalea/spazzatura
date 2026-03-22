/**
 * Memory management tool
 */

import type { Tool, ToolResult, JSONSchema } from '../types.js';

/**
 * Memory tool configuration
 */
export interface MemoryToolConfig {
  /** Memory store to use */
  readonly store?: Map<string, unknown>;
}

/**
 * Memory operation parameters
 */
interface MemoryStoreParams {
  readonly operation: 'store';
  readonly key: string;
  readonly value: unknown;
}

interface MemoryRetrieveParams {
  readonly operation: 'retrieve';
  readonly key: string;
}

interface MemoryListParams {
  readonly operation: 'list';
  readonly pattern?: string;
}

interface MemoryDeleteParams {
  readonly operation: 'delete';
  readonly key: string;
}

interface MemoryClearParams {
  readonly operation: 'clear';
}

type MemoryParams =
  | MemoryStoreParams
  | MemoryRetrieveParams
  | MemoryListParams
  | MemoryDeleteParams
  | MemoryClearParams;

/**
 * Memory tool for storing and retrieving data
 */
export class MemoryTool implements Tool {
  readonly name = 'memory';
  readonly description = 'Memory management: store, retrieve, list, and delete data';
  readonly parameters: JSONSchema = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['store', 'retrieve', 'list', 'delete', 'clear'],
        description: 'The memory operation to perform',
      },
      key: {
        type: 'string',
        description: 'Key for the data',
      },
      value: {
        type: 'object',
        description: 'Value to store',
      },
      pattern: {
        type: 'string',
        description: 'Pattern to filter keys (supports wildcards)',
      },
    },
    required: ['operation'],
  };

  private readonly store: Map<string, unknown>;

  constructor(config: MemoryToolConfig = {}) {
    this.store = config.store ?? new Map();
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const memoryParams = params as unknown as MemoryParams;

    try {
      switch (memoryParams.operation) {
        case 'store':
          return await this.storeValue(memoryParams);
        case 'retrieve':
          return await this.retrieveValue(memoryParams);
        case 'list':
          return await this.listKeys(memoryParams);
        case 'delete':
          return await this.deleteKey(memoryParams);
        case 'clear':
          return await this.clearAll();
        default:
          return {
            success: false,
            output: null,
            error: `Unknown operation: ${(memoryParams as { operation: string }).operation}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async storeValue(params: MemoryStoreParams): Promise<ToolResult> {
    this.store.set(params.key, params.value);
    return {
      success: true,
      output: {
        key: params.key,
        message: 'Value stored successfully',
      },
    };
  }

  private async retrieveValue(params: MemoryRetrieveParams): Promise<ToolResult> {
    const value = this.store.get(params.key);

    if (value === undefined && !this.store.has(params.key)) {
      return {
        success: false,
        output: null,
        error: `Key not found: ${params.key}`,
      };
    }

    return {
      success: true,
      output: {
        key: params.key,
        value,
      },
    };
  }

  private async listKeys(params: MemoryListParams): Promise<ToolResult> {
    let keys = Array.from(this.store.keys());

    if (params.pattern) {
      const regex = this.patternToRegex(params.pattern);
      keys = keys.filter((key) => regex.test(key));
    }

    return {
      success: true,
      output: {
        keys,
        count: keys.length,
      },
    };
  }

  private async deleteKey(params: MemoryDeleteParams): Promise<ToolResult> {
    if (!this.store.has(params.key)) {
      return {
        success: false,
        output: null,
        error: `Key not found: ${params.key}`,
      };
    }

    this.store.delete(params.key);
    return {
      success: true,
      output: {
        key: params.key,
        message: 'Key deleted successfully',
      },
    };
  }

  private async clearAll(): Promise<ToolResult> {
    const count = this.store.size;
    this.store.clear();
    return {
      success: true,
      output: {
        message: 'Memory cleared',
        deletedCount: count,
      },
    };
  }

  private patternToRegex(pattern: string): RegExp {
    // Convert wildcard pattern to regex
    // * matches any sequence of characters
    // ? matches any single character
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regexPattern}$`, 'i');
  }

  /**
   * Get the underlying store
   */
  getStore(): Map<string, unknown> {
    return this.store;
  }
}

/**
 * Create a memory tool with optional configuration
 */
export function createMemoryTool(config?: MemoryToolConfig): Tool {
  return new MemoryTool(config);
}

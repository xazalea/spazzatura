/**
 * Web operations tool
 */

import type { Tool, ToolResult, JSONSchema } from '../types.js';

/**
 * Web tool configuration
 */
export interface WebToolConfig {
  /** Default timeout for requests in milliseconds */
  readonly timeout?: number;
  /** User agent for requests */
  readonly userAgent?: string;
  /** Maximum response size in bytes */
  readonly maxResponseSize?: number;
  /** Search API key (optional) */
  readonly searchApiKey?: string;
  /** Search API endpoint (optional) */
  readonly searchApiEndpoint?: string;
}

/**
 * Web operation parameters
 */
interface WebFetchParams {
  readonly operation: 'fetch_url';
  readonly url: string;
  readonly method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly headers?: Record<string, string>;
  readonly body?: string;
}

interface WebSearchParams {
  readonly operation: 'search_web';
  readonly query: string;
  readonly limit?: number;
}

type WebParams = WebFetchParams | WebSearchParams;

/**
 * Web tool for HTTP operations and web search
 */
export class WebTool implements Tool {
  readonly name = 'web';
  readonly description = 'Web operations: fetch URLs, search the web';
  readonly parameters: JSONSchema = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['fetch_url', 'search_web'],
        description: 'The web operation to perform',
      },
      url: {
        type: 'string',
        description: 'URL to fetch (for fetch_url operation)',
      },
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'DELETE'],
        description: 'HTTP method',
      },
      headers: {
        type: 'object',
        description: 'HTTP headers',
      },
      body: {
        type: 'string',
        description: 'Request body',
      },
      query: {
        type: 'string',
        description: 'Search query (for search_web operation)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of search results',
      },
    },
    required: ['operation'],
  };

  private readonly timeout: number;
  private readonly userAgent: string;
  private readonly maxResponseSize: number;
  private readonly searchApiKeyValue: string | undefined;
  private readonly searchApiEndpointValue: string | undefined;

  constructor(config: WebToolConfig = {}) {
    this.timeout = config.timeout ?? 30000;
    this.userAgent = config.userAgent ?? 'Spazzatura/1.0';
    this.maxResponseSize = config.maxResponseSize ?? 10 * 1024 * 1024; // 10MB
    this.searchApiKeyValue = config.searchApiKey ?? undefined;
    this.searchApiEndpointValue = config.searchApiEndpoint ?? undefined;
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const webParams = params as unknown as WebParams;

    try {
      switch (webParams.operation) {
        case 'fetch_url':
          return await this.fetchUrl(webParams);
        case 'search_web':
          return await this.searchWeb(webParams);
        default:
          return {
            success: false,
            output: null,
            error: `Unknown operation: ${(webParams as { operation: string }).operation}`,
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

  private async fetchUrl(params: WebFetchParams): Promise<ToolResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const fetchOptions: RequestInit = {
        method: params.method ?? 'GET',
        headers: {
          'User-Agent': this.userAgent,
          ...params.headers,
        },
        signal: controller.signal,
      };

      if (params.body !== undefined) {
        fetchOptions.body = params.body;
      }

      const response = await fetch(params.url, fetchOptions);

      clearTimeout(timeoutId);

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > this.maxResponseSize) {
        return {
          success: false,
          output: null,
          error: `Response too large: ${contentLength} bytes (max: ${this.maxResponseSize})`,
        };
      }

      const text = await response.text();

      if (response.ok) {
        return {
          success: true,
          output: {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: text,
          },
        };
      } else {
        return {
          success: false,
          output: {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: text,
          },
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          output: null,
          error: `Request timed out after ${this.timeout}ms`,
        };
      }
      throw error;
    }
  }

  private async searchWeb(params: WebSearchParams): Promise<ToolResult> {
    if (!this.searchApiKeyValue || !this.searchApiEndpointValue) {
      return {
        success: false,
        output: null,
        error: 'Web search not configured. Set searchApiKey and searchApiEndpoint.',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.searchApiEndpointValue, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.searchApiKeyValue}`,
        },
        body: JSON.stringify({
          query: params.query,
          limit: params.limit ?? 10,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const results = await response.json();

      if (response.ok) {
        return {
          success: true,
          output: results,
        };
      } else {
        return {
          success: false,
          output: results,
          error: `Search failed: ${response.statusText}`,
        };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          output: null,
          error: `Search timed out after ${this.timeout}ms`,
        };
      }
      throw error;
    }
  }
}

/**
 * Create a web tool with optional configuration
 */
export function createWebTool(config?: WebToolConfig): Tool {
  return new WebTool(config);
}

/**
 * GPT4Free-TS Provider
 * 
 * Provides access to multiple LLM providers through the gpt4free-ts aggregation proxy.
 * Features: chat, streaming (multi-provider aggregation)
 * 
 * Models: Dynamic (depends on available providers)
 * Authentication: None required for most providers
 */

import { OpenAICompatibleProvider } from '../base.js';
import type {
  Provider,
  ProviderConfig,
  ProviderCapabilities,
  ProviderStatus,
  Message,
  ChatOptions,
  ChatResponse,
  StreamChunk,
} from '../types.js';
import { ProviderError } from '../types.js';
import { getDefaultCapabilities } from '../config.js';

/**
 * GPT4Free provider configuration
 */
export interface GPT4FreeConfig extends ProviderConfig {
  type: 'gpt4free';
  /** Base URL for GPT4Free API */
  baseUrl?: string;
  /** Default site/provider to use */
  defaultSite?: string;
  /** Proxy URL for accessing blocked sites */
  proxyUrl?: string;
}

/**
 * Available site/provider info
 */
export interface SiteInfo {
  /** Site identifier */
  name: string;
  /** Available models */
  models: string[];
  /** Whether site is available */
  available: boolean;
}

/**
 * GPT4Free-TS Provider implementation
 */
export class GPT4FreeProvider extends OpenAICompatibleProvider implements Provider {
  readonly name = 'gpt4free';
  readonly type = 'gpt4free' as const;
  
  readonly capabilities: ProviderCapabilities;
  readonly config: ProviderConfig;
  
  private availableSites: SiteInfo[] = [];
  private lastSitesCheck: Date | null = null;

  constructor(config: Partial<GPT4FreeConfig> = {}) {
    const fullConfig: ProviderConfig = {
      name: 'gpt4free',
      type: 'gpt4free',
      baseUrl: config.baseUrl ?? 'http://localhost:8080',
      models: config.models ?? ['gpt-3.5-turbo', 'gpt-4', 'claude-2', 'llama-2-70b'],
      defaultModel: config.defaultModel ?? 'gpt-3.5-turbo',
      timeout: config.timeout ?? 60000, // Longer timeout for multi-provider
      maxRetries: config.maxRetries ?? 3,
      enabled: config.enabled ?? true,
      ...config,
    };
    
    super(fullConfig);
    this.config = fullConfig;
    this.capabilities = getDefaultCapabilities('gpt4free');
  }

  /**
   * Get default base URL
   */
  protected getDefaultBaseUrl(): string {
    return 'http://localhost:8080';
  }

  /**
   * Build headers for GPT4Free API requests
   */
  protected override buildHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };

    // GPT4Free typically doesn't require authentication
    // But we pass any configured headers
    if (this.config.headers) {
      Object.assign(headers, this.config.headers);
    }

    return headers;
  }

  /**
   * Get available sites/providers
   */
  async getAvailableSites(): Promise<SiteInfo[]> {
    // Cache sites for 5 minutes
    if (this.lastSitesCheck && 
        Date.now() - this.lastSitesCheck.getTime() < 5 * 60 * 1000 &&
        this.availableSites.length > 0) {
      return this.availableSites;
    }

    try {
      const response = await fetch(`${this.getBaseUrl()}/supports`, {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: this.createAbortSignal(10000),
      });

      if (!response.ok) {
        throw new Error(`Failed to get sites: ${response.status}`);
      }

      const data = await response.json() as Record<string, string[]>;
      
      this.availableSites = Object.entries(data).map(([name, models]) => ({
        name,
        models,
        available: true,
      }));
      
      this.lastSitesCheck = new Date();
      return this.availableSites;
    } catch (error) {
      // Return default sites if fetch fails
      return [
        { name: 'you', models: ['gpt-3.5-turbo'], available: true },
        { name: 'phind', models: ['net-gpt-3.5-turbo'], available: true },
        { name: 'forefront', models: ['gpt-3.5-turbo', 'claude'], available: true },
        { name: 'fakeopen', models: ['gpt-3.5-turbo', 'gpt-4'], available: true },
      ];
    }
  }

  /**
   * Send a chat completion request with site selection
   */
  override async chat(messages: readonly Message[], options?: ChatOptions): Promise<ChatResponse> {
    return this.request(async () => {
      const mergedOptions = this.mergeOptions(options);
      const formattedMessages = this.formatMessages(messages);

      // Build URL with optional site parameter
      let url = `${this.getBaseUrl()}/v1/chat/completions`;
      const site = (options as ChatOptions & { site?: string })?.site ?? 
                   (this.config as GPT4FreeConfig).defaultSite;
      
      if (site) {
        url += `?site=${encodeURIComponent(site)}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: mergedOptions.model,
          messages: formattedMessages,
          temperature: mergedOptions.temperature,
          max_tokens: mergedOptions.maxTokens,
          top_p: mergedOptions.topP,
          stop: mergedOptions.stop,
          stream: false,
        }),
        signal: this.createAbortSignal(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ProviderError(
          `Chat request failed: ${response.status} ${response.statusText} - ${errorText}`,
          this.name,
          response.status.toString(),
          response.status,
          response.status === 429 || response.status >= 500
        );
      }

      const data = await response.json() as {
        choices: Array<{
          message: { content: string };
          finish_reason: string;
        }>;
        model: string;
        usage?: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      };

      return {
        content: data.choices[0]?.message?.content ?? '',
        model: data.model,
        ...(data.usage ? {
          usage: {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          },
        } : {}),
        ...(data.choices[0]?.finish_reason ? {
          finishReason: data.choices[0].finish_reason,
        } : {}),
      } as ChatResponse;
    }, 'chat');
  }

  /**
   * Stream a chat completion request
   */
  override async *stream(messages: readonly Message[], options?: ChatOptions): AsyncIterable<StreamChunk> {
    const mergedOptions = this.mergeOptions(options);
    const formattedMessages = this.formatMessages(messages);

    let url = `${this.getBaseUrl()}/v1/chat/completions`;
    const site = (options as ChatOptions & { site?: string })?.site ?? 
                 (this.config as GPT4FreeConfig).defaultSite;
    
    if (site) {
      url += `?site=${encodeURIComponent(site)}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        model: mergedOptions.model,
        messages: formattedMessages,
        temperature: mergedOptions.temperature,
        max_tokens: mergedOptions.maxTokens,
        top_p: mergedOptions.topP,
        stop: mergedOptions.stop,
        stream: true,
      }),
      signal: this.createAbortSignal(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ProviderError(
        `Stream request failed: ${response.status} ${response.statusText} - ${errorText}`,
        this.name,
        response.status.toString(),
        response.status,
        response.status === 429 || response.status >= 500
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new ProviderError('No response body', this.name);
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6)) as {
                choices: Array<{
                  delta: { content?: string };
                  finish_reason: string | null;
                }>;
              };
              const delta = json.choices[0]?.delta?.content ?? '';
              const finishReason = json.choices[0]?.finish_reason;

              if (delta || finishReason) {
                yield {
                  delta,
                  done: finishReason === 'stop',
                };
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      yield { delta: '', done: true };
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Simple ask endpoint for quick queries
   */
  async ask(prompt: string, model?: string, site?: string): Promise<string> {
    const params = new URLSearchParams({
      prompt,
      ...(model ? { model } : {}),
      ...(site ? { site } : {}),
    });

    const response = await fetch(`${this.getBaseUrl()}/ask?${params}`, {
      method: 'GET',
      headers: this.buildHeaders(),
      signal: this.createAbortSignal(),
    });

    if (!response.ok) {
      throw new ProviderError(
        `Ask request failed: ${response.status}`,
        this.name,
        response.status.toString(),
        response.status
      );
    }

    return await response.text();
  }

  /**
   * Get provider health status
   */
  override async getHealth(): Promise<ProviderStatus> {
    try {
      const { latency } = await this.measureLatency(async () => {
        const response = await fetch(`${this.getBaseUrl()}/supports`, {
          method: 'GET',
          headers: this.buildHeaders(),
          signal: this.createAbortSignal(5000),
        });

        if (!response.ok) {
          throw new Error(`Health check failed: ${response.status}`);
        }

        return response;
      });

      // Refresh available sites
      await this.getAvailableSites();

      return {
        name: this.name,
        available: true,
        latency,
        lastChecked: new Date(),
        models: this.getModels(),
      };
    } catch (error) {
      return {
        name: this.name,
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date(),
        models: this.getModels(),
      };
    }
  }
}

/**
 * Create a GPT4Free provider instance
 */
export function createGPT4FreeProvider(config?: Partial<GPT4FreeConfig>): GPT4FreeProvider {
  return new GPT4FreeProvider(config);
}

/**
 * Default GPT4Free provider instance
 */
export const gpt4freeProvider = new GPT4FreeProvider();

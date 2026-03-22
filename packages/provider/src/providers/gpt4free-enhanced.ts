/**
 * GPT4Free Enhanced Provider
 *
 * Enhanced gpt4free with more providers (xiangsx/gpt4free-ts pattern).
 * Points to a local gpt4free-ts instance that exposes an OpenAI-compatible
 * API with support for GPT-4, Claude, Gemini, and Llama models.
 *
 * Authentication: none required
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
 * GPT4Free Enhanced provider configuration
 */
export interface GPT4FreeEnhancedConfig extends ProviderConfig {
  type: 'gpt4free-enhanced';
  /** Preferred upstream provider/site */
  defaultSite?: string;
}

/**
 * GPT4Free Enhanced Provider implementation
 */
export class GPT4FreeEnhancedProvider extends OpenAICompatibleProvider implements Provider {
  readonly name = 'gpt4free-enhanced';
  readonly type = 'gpt4free-enhanced' as const;

  readonly capabilities: ProviderCapabilities;
  readonly config: ProviderConfig;

  constructor(config: Partial<GPT4FreeEnhancedConfig> = {}) {
    const fullConfig: ProviderConfig = {
      name: 'gpt4free-enhanced',
      type: 'gpt4free-enhanced',
      baseUrl: config.baseUrl ?? process.env['GPT4FREE_ENHANCED_BASE_URL'] ?? 'http://localhost:3000',
      models: config.models ?? ['gpt-4', 'gpt-4o', 'claude-3', 'gemini-pro', 'llama-3'],
      defaultModel: config.defaultModel ?? 'gpt-4',
      timeout: config.timeout ?? 90000,
      maxRetries: config.maxRetries ?? 3,
      enabled: config.enabled ?? true,
      ...config,
    };

    super(fullConfig);
    this.config = fullConfig;
    this.capabilities = getDefaultCapabilities('gpt4free-enhanced');
  }

  protected getDefaultBaseUrl(): string {
    return 'http://localhost:3000';
  }

  protected override buildHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };

    if (this.config.headers) {
      Object.assign(headers, this.config.headers);
    }

    return headers;
  }

  override async chat(messages: readonly Message[], options?: ChatOptions): Promise<ChatResponse> {
    return this.request(async () => {
      const mergedOptions = this.mergeOptions(options);
      const formattedMessages = this.formatMessages(messages);

      const site = (this.config as GPT4FreeEnhancedConfig).defaultSite;
      let url = `${this.getBaseUrl()}/v1/chat/completions`;
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
        ...(data.usage !== undefined ? {
          usage: {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          },
        } : {}),
        ...(data.choices[0]?.finish_reason !== undefined ? {
          finishReason: data.choices[0].finish_reason,
        } : {}),
      } as ChatResponse;
    }, 'chat');
  }

  override async *stream(messages: readonly Message[], options?: ChatOptions): AsyncIterable<StreamChunk> {
    const mergedOptions = this.mergeOptions(options);
    const formattedMessages = this.formatMessages(messages);

    const site = (this.config as GPT4FreeEnhancedConfig).defaultSite;
    let url = `${this.getBaseUrl()}/v1/chat/completions`;
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
                yield { delta, done: finishReason === 'stop' };
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

  override async getHealth(): Promise<ProviderStatus> {
    try {
      const { latency } = await this.measureLatency(async () => {
        const response = await fetch(`${this.getBaseUrl()}/v1/models`, {
          method: 'GET',
          headers: this.buildHeaders(),
          signal: this.createAbortSignal(5000),
        });
        if (!response.ok) {
          throw new Error(`Health check failed: ${response.status}`);
        }
        return response;
      });

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

export function createGPT4FreeEnhancedProvider(config?: Partial<GPT4FreeEnhancedConfig>): GPT4FreeEnhancedProvider {
  return new GPT4FreeEnhancedProvider(config);
}

export const gpt4freeEnhancedProvider = new GPT4FreeEnhancedProvider();

/**
 * AIClient Provider
 *
 * Multi-provider cookie-based client (justlovemaki/AIClient-2-API pattern).
 * Exposes an OpenAI-compatible API that proxies ChatGPT, Claude, and Gemini
 * using browser session cookies managed server-side.
 *
 * Authentication: AICLIENT_COOKIE env var (optional – server manages cookies)
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
 * AIClient provider configuration
 */
export interface AIClientConfig extends ProviderConfig {
  type: 'aiclient';
  /** Session cookie for AIClient server */
  cookie?: string;
}

/**
 * AIClient Provider implementation
 */
export class AIClientProvider extends OpenAICompatibleProvider implements Provider {
  readonly name = 'aiclient';
  readonly type = 'aiclient' as const;

  readonly capabilities: ProviderCapabilities;
  readonly config: ProviderConfig;

  constructor(config: Partial<AIClientConfig> = {}) {
    const cookie = config.cookie ?? process.env['AICLIENT_COOKIE'];
    const fullConfig: ProviderConfig = {
      name: 'aiclient',
      type: 'aiclient',
      baseUrl: config.baseUrl ?? process.env['AICLIENT_BASE_URL'] ?? 'http://localhost:3000',
      models: config.models ?? ['gpt-3.5-turbo', 'gpt-4', 'claude-3-sonnet', 'gemini-pro'],
      defaultModel: config.defaultModel ?? 'gpt-3.5-turbo',
      timeout: config.timeout ?? 60000,
      maxRetries: config.maxRetries ?? 3,
      enabled: config.enabled ?? true,
      ...(cookie !== undefined ? { cookie } : {}),
      ...config,
    };

    super(fullConfig);
    this.config = fullConfig;
    this.capabilities = getDefaultCapabilities('aiclient');
  }

  protected getDefaultBaseUrl(): string {
    return 'http://localhost:3000';
  }

  protected override buildHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };

    if (this.config.cookie) {
      headers['Cookie'] = this.config.cookie;
    }

    if (this.config.headers) {
      Object.assign(headers, this.config.headers);
    }

    return headers;
  }

  override async chat(messages: readonly Message[], options?: ChatOptions): Promise<ChatResponse> {
    return this.request(async () => {
      const mergedOptions = this.mergeOptions(options);
      const formattedMessages = this.formatMessages(messages);

      const response = await fetch(`${this.getBaseUrl()}/v1/chat/completions`, {
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

    const response = await fetch(`${this.getBaseUrl()}/v1/chat/completions`, {
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

export function createAIClientProvider(config?: Partial<AIClientConfig>): AIClientProvider {
  return new AIClientProvider(config);
}

export const aiclientProvider = new AIClientProvider();

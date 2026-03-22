/**
 * Chat2API Provider
 *
 * Cookie-based ChatGPT proxy provider. Compatible with Chat2API instances
 * that expose an OpenAI-compatible API surface using browser session cookies.
 *
 * Authentication: CHAT2API_COOKIE env var (optional – works without cookie for
 * unauthenticated/public instances)
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
 * Chat2API provider configuration
 */
export interface Chat2APIConfig extends ProviderConfig {
  type: 'chat2api';
  /** Cookie string for authenticated ChatGPT session */
  cookie?: string;
}

/**
 * Chat2API Provider implementation
 */
export class Chat2APIProvider extends OpenAICompatibleProvider implements Provider {
  readonly name = 'chat2api';
  readonly type = 'chat2api' as const;

  readonly capabilities: ProviderCapabilities;
  readonly config: ProviderConfig;

  constructor(config: Partial<Chat2APIConfig> = {}) {
    const cookie = config.cookie ?? process.env['CHAT2API_COOKIE'];
    const fullConfig: ProviderConfig = {
      name: 'chat2api',
      type: 'chat2api',
      baseUrl: config.baseUrl ?? process.env['CHAT2API_BASE_URL'] ?? 'http://localhost:8080',
      models: config.models ?? ['gpt-3.5-turbo', 'gpt-4', 'gpt-4o', 'gpt-4o-mini'],
      defaultModel: config.defaultModel ?? 'gpt-3.5-turbo',
      timeout: config.timeout ?? 60000,
      maxRetries: config.maxRetries ?? 3,
      enabled: config.enabled ?? true,
      ...(cookie !== undefined ? { cookie } : {}),
      ...config,
    };

    super(fullConfig);
    this.config = fullConfig;
    this.capabilities = getDefaultCapabilities('chat2api');
  }

  protected getDefaultBaseUrl(): string {
    return 'http://localhost:8080';
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

export function createChat2APIProvider(config?: Partial<Chat2APIConfig>): Chat2APIProvider {
  return new Chat2APIProvider(config);
}

export const chat2apiProvider = new Chat2APIProvider();

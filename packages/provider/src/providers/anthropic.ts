/**
 * Anthropic Provider
 * 
 * Standard Anthropic API provider for users with official API keys.
 * Features: chat, streaming, vision
 * 
 * Models: claude-3-opus, claude-3-sonnet, claude-3-haiku
 * Authentication: API key (required)
 */

import { BaseProvider } from '../base.js';
import type {
  Provider,
  ProviderConfig,
  ProviderCapabilities,
  ProviderStatus,
  Message,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ToolDefinition,
  ToolCallResult,
} from '../types.js';
import { ProviderError } from '../types.js';
import { getDefaultCapabilities } from '../config.js';

/**
 * Anthropic provider configuration
 */
export interface AnthropicConfig extends ProviderConfig {
  type: 'anthropic';
  /** Anthropic API key (required) */
  apiKey: string;
  /** Base URL for Anthropic API */
  baseUrl?: string;
}

/**
 * Anthropic Provider implementation
 * Uses the Anthropic Messages API (not OpenAI-compatible)
 */
export class AnthropicProvider extends BaseProvider implements Provider {
  readonly name = 'anthropic';
  readonly type = 'anthropic' as const;
  
  readonly capabilities: ProviderCapabilities;
  readonly config: ProviderConfig;

  constructor(config: Partial<AnthropicConfig> & { apiKey: string }) {
    const fullConfig: ProviderConfig = {
      name: 'anthropic',
      type: 'anthropic',
      baseUrl: config.baseUrl ?? 'https://api.anthropic.com',
      models: config.models ?? [
        'claude-opus-4-6',
        'claude-sonnet-4-6',
        'claude-haiku-4-5-20251001',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
      ],
      defaultModel: config.defaultModel ?? 'claude-sonnet-4-6',
      timeout: config.timeout ?? 60000,
      maxRetries: config.maxRetries ?? 3,
      enabled: config.enabled ?? true,
      ...config,
    };
    
    super(fullConfig);
    this.config = fullConfig;
    this.capabilities = getDefaultCapabilities('anthropic');
  }

  /**
   * Get default base URL
   */
  protected getDefaultBaseUrl(): string {
    return 'https://api.anthropic.com';
  }

  /**
   * Build headers for Anthropic API requests
   */
  protected override buildHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey!,
      'anthropic-version': '2023-06-01',
      ...additionalHeaders,
    };

    // Add custom headers from config
    if (this.config.headers) {
      Object.assign(headers, this.config.headers);
    }

    return headers;
  }

  /**
   * Convert messages to Anthropic format
   */
  private formatMessagesForAnthropic(messages: readonly Message[]): {
    system?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string | unknown[] }>;
  } {
    const formattedMessages: Array<{ role: 'user' | 'assistant'; content: string | unknown[] }> = [];
    let system: string | undefined;

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Anthropic uses a separate system parameter
        system = typeof msg.content === 'string' ? msg.content : msg.content.map(p => p.text).join('\n');
      } else {
        const content = typeof msg.content === 'string' 
          ? msg.content 
          : msg.content.map(part => {
              if (part.type === 'text') {
                return { type: 'text', text: part.text };
              }
              if (part.type === 'image' && part.imageUrl) {
                // Anthropic expects base64 images
                const url = part.imageUrl.url;
                if (url.startsWith('data:')) {
                  const parts = url.split(';base64,');
                  const mediaType = parts[0];
                  const data = parts[1];
                  if (mediaType && data) {
                    const type = mediaType.replace('data:', '');
                    return {
                      type: 'image',
                      source: {
                        type: 'base64',
                        media_type: type,
                        data,
                      },
                    };
                  }
                }
              }
              return part;
            });
        
        formattedMessages.push({
          role: msg.role as 'user' | 'assistant',
          content,
        });
      }
    }

    const result: { system?: string; messages: Array<{ role: 'user' | 'assistant'; content: string | unknown[] }> } = {
      messages: formattedMessages,
    };
    if (system !== undefined) {
      result.system = system;
    }
    return result;
  }

  /**
   * Create an abort signal with timeout
   */
  private createAbortSignal(timeoutMs?: number): AbortSignal {
    const timeout = timeoutMs ?? this.config.timeout ?? 30000;
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeout);
    return controller.signal;
  }

  /**
   * Convert tools to Anthropic format
   */
  private formatToolsForAnthropic(tools: readonly ToolDefinition[]): unknown[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  /**
   * Send a chat completion request
   */
  async chat(messages: readonly Message[], options?: ChatOptions): Promise<ChatResponse> {
    return this.request(async () => {
      const mergedOptions = this.mergeOptions(options);
      const { system, messages: formattedMessages } = this.formatMessagesForAnthropic(messages);

      const body: Record<string, unknown> = {
        model: mergedOptions.model,
        max_tokens: mergedOptions.maxTokens,
        temperature: mergedOptions.temperature,
        top_p: mergedOptions.topP,
        stop_sequences: mergedOptions.stop,
        system,
        messages: formattedMessages,
      };

      if (options?.tools && options.tools.length > 0) {
        body['tools'] = this.formatToolsForAnthropic(options.tools);
        if (options.toolChoice === 'none') {
          body['tool_choice'] = { type: 'none' };
        } else if (options.toolChoice && options.toolChoice !== 'auto') {
          body['tool_choice'] = { type: 'tool', name: options.toolChoice };
        } else {
          body['tool_choice'] = { type: 'auto' };
        }
      }

      const response = await fetch(`${this.getBaseUrl()}/v1/messages`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
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
        content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
        model: string;
        stop_reason: string;
        usage: {
          input_tokens: number;
          output_tokens: number;
        };
      };

      // Extract text from content blocks
      const content = data.content
        .filter(block => block.type === 'text')
        .map(block => block.text ?? '')
        .join('');

      // Extract tool use blocks
      const toolCalls: ToolCallResult[] = data.content
        .filter(block => block.type === 'tool_use' && block.id && block.name)
        .map(block => ({
          id: block.id!,
          name: block.name!,
          arguments: block.input ?? {},
        }));

      const result: ChatResponse = {
        content,
        model: data.model,
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
        },
        finishReason: data.stop_reason,
      };

      if (toolCalls.length > 0) {
        return { ...result, toolCalls };
      }

      return result;
    }, 'chat');
  }

  /**
   * Stream a chat completion request
   */
  async *stream(messages: readonly Message[], options?: ChatOptions): AsyncIterable<StreamChunk> {
    const mergedOptions = this.mergeOptions(options);
    const { system, messages: formattedMessages } = this.formatMessagesForAnthropic(messages);

    const response = await fetch(`${this.getBaseUrl()}/v1/messages`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        model: mergedOptions.model,
        max_tokens: mergedOptions.maxTokens,
        temperature: mergedOptions.temperature,
        top_p: mergedOptions.topP,
        stop_sequences: mergedOptions.stop,
        system,
        messages: formattedMessages,
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
          
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6)) as {
              type: string;
              delta?: { text?: string };
              message?: { stop_reason?: string };
            };

            if (json.type === 'content_block_delta' && json.delta?.text) {
              yield {
                delta: json.delta.text,
                done: false,
              };
            } else if (json.type === 'message_stop') {
              yield {
                delta: '',
                done: true,
              };
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      yield { delta: '', done: true };
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get provider health status
   */
  async getHealth(): Promise<ProviderStatus> {
    try {
      // Anthropic doesn't have a models endpoint, so we just check if the API key is set
      if (!this.config.apiKey) {
        throw new Error('API key not configured');
      }

      // Try a minimal request
      const { latency } = await this.measureLatency(async () => {
        const response = await fetch(`${this.getBaseUrl()}/v1/messages`, {
          method: 'POST',
          headers: this.buildHeaders(),
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
          signal: this.createAbortSignal(5000),
        });

        // Even a 400 response means the API is reachable
        if (response.status >= 500) {
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

/**
 * Create an Anthropic provider instance
 */
export function createAnthropicProvider(config: Partial<AnthropicConfig> & { apiKey: string }): AnthropicProvider {
  return new AnthropicProvider(config);
}

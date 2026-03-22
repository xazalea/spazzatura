/**
 * OpenRouter Provider
 *
 * Unified gateway to 100+ LLM models including Claude, GPT, Llama, Mistral,
 * Qwen, DeepSeek, Gemini, and more — via a single OpenAI-compatible API.
 * Free tier available with no credit card for many models.
 *
 * Models: All major LLMs (see https://openrouter.ai/models)
 * Authentication: API key (free tier available at openrouter.ai)
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
  ToolDefinition,
  ToolCallResult,
} from '../types.js';
import { ProviderError } from '../types.js';

export interface OpenRouterConfig extends ProviderConfig {
  type: 'openrouter';
  apiKey: string;
  /** HTTP referer for OpenRouter usage tracking */
  httpReferer?: string;
  /** App title for OpenRouter usage tracking */
  appTitle?: string;
}

/**
 * Free models available on OpenRouter (no cost, rate limited)
 */
export const OPENROUTER_FREE_MODELS = [
  'meta-llama/llama-3.2-3b-instruct:free',
  'meta-llama/llama-3.2-1b-instruct:free',
  'google/gemma-2-9b-it:free',
  'mistralai/mistral-7b-instruct:free',
  'qwen/qwen-2-7b-instruct:free',
  'microsoft/phi-3-mini-128k-instruct:free',
] as const;

/**
 * Premium models available on OpenRouter
 */
export const OPENROUTER_PREMIUM_MODELS = [
  'anthropic/claude-opus-4',
  'anthropic/claude-sonnet-4-5',
  'anthropic/claude-3-5-sonnet',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openai/o1-mini',
  'google/gemini-pro-1.5',
  'google/gemini-flash-1.5',
  'meta-llama/llama-3.1-405b-instruct',
  'meta-llama/llama-3.1-70b-instruct',
  'mistralai/mistral-large',
  'qwen/qwen-2.5-72b-instruct',
  'deepseek/deepseek-chat',
  'deepseek/deepseek-coder',
  'cohere/command-r-plus',
] as const;

/**
 * OpenRouter Provider
 * Routes requests to 100+ models via OpenAI-compatible API
 */
export class OpenRouterProvider extends OpenAICompatibleProvider implements Provider {
  readonly name = 'openrouter';
  readonly type = 'openrouter' as const;

  readonly capabilities: ProviderCapabilities = {
    chat: true,
    streaming: true,
    vision: true,
    tts: false,
    stt: false,
    imageGeneration: false,
    embedding: false,
    functionCalling: true,
    maxContextLength: 200000, // Varies by model
  };

  readonly config: ProviderConfig;

  constructor(config: Partial<OpenRouterConfig> & { apiKey: string }) {
    const fullConfig: ProviderConfig = {
      name: 'openrouter',
      type: 'openrouter',
      baseUrl: 'https://openrouter.ai/api',
      models: [
        ...OPENROUTER_FREE_MODELS,
        ...OPENROUTER_PREMIUM_MODELS,
      ],
      defaultModel: config.defaultModel ?? 'meta-llama/llama-3.2-3b-instruct:free',
      timeout: config.timeout ?? 60000,
      maxRetries: config.maxRetries ?? 3,
      enabled: config.enabled ?? true,
      ...config,
    };

    super(fullConfig);
    this.config = fullConfig;
  }

  protected getDefaultBaseUrl(): string {
    return 'https://openrouter.ai/api';
  }

  protected override buildHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    const routerConfig = this.config as OpenRouterConfig;
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'HTTP-Referer': routerConfig.httpReferer ?? 'https://github.com/spazzatura/spazzatura',
      'X-Title': routerConfig.appTitle ?? 'Spazzatura CLI',
      ...additionalHeaders,
    };
  }

  /**
   * Format tools for OpenAI-compatible tool calling
   */
  private formatTools(tools: readonly ToolDefinition[]): unknown[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Chat with tool calling support
   */
  override async chat(messages: readonly Message[], options?: ChatOptions): Promise<ChatResponse> {
    if (!options?.tools || options.tools.length === 0) {
      return super.chat(messages, options);
    }

    return this.request(async () => {
      const mergedOptions = this.mergeOptions(options);
      const formattedMessages = this.formatMessages(messages);

      const body: Record<string, unknown> = {
        model: mergedOptions.model,
        messages: formattedMessages,
        temperature: mergedOptions.temperature,
        max_tokens: mergedOptions.maxTokens,
        top_p: mergedOptions.topP,
        stop: mergedOptions.stop,
        stream: false,
        tools: this.formatTools(options.tools!),
        tool_choice: options.toolChoice ?? 'auto',
      };

      const response = await fetch(`${this.getBaseUrl()}/v1/chat/completions`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: this.createAbortSignal(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ProviderError(
          `OpenRouter chat failed: ${response.status} ${response.statusText} - ${errorText}`,
          this.name,
          response.status.toString(),
          response.status,
          response.status === 429 || response.status >= 500
        );
      }

      const data = await response.json() as {
        id: string;
        model: string;
        choices: Array<{
          message: {
            role: string;
            content: string | null;
            tool_calls?: Array<{
              id: string;
              type: string;
              function: { name: string; arguments: string };
            }>;
          };
          finish_reason: string;
        }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      const choice = data.choices[0];
      if (!choice) throw new ProviderError('No response choices', this.name);

      const content = choice.message.content ?? '';

      const toolCalls: ToolCallResult[] = (choice.message.tool_calls ?? []).map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: (() => {
          try { return JSON.parse(tc.function.arguments) as Record<string, unknown>; } catch { return {}; }
        })(),
      }));

      const result: ChatResponse = {
        content,
        model: data.model,
        finishReason: choice.finish_reason,
        ...(data.usage ? {
          usage: {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          },
        } : {}),
      };

      if (toolCalls.length > 0) {
        return { ...result, toolCalls };
      }

      return result;
    }, 'chat');
  }

  /**
   * Get health status by listing models
   */
  override async getHealth(): Promise<ProviderStatus> {
    if (!this.config.apiKey) {
      return {
        name: this.name,
        available: false,
        error: 'API key not configured (get free key at openrouter.ai)',
        lastChecked: new Date(),
      };
    }

    try {
      const start = Date.now();
      const response = await fetch(`${this.getBaseUrl()}/v1/models`, {
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(5000),
      });

      const latency = Date.now() - start;

      return {
        name: this.name,
        available: response.ok,
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
      };
    }
  }
}

export function createOpenRouterProvider(config: Partial<OpenRouterConfig> & { apiKey: string }): OpenRouterProvider {
  return new OpenRouterProvider(config);
}

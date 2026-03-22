/**
 * Base provider class with common functionality
 * Provides HTTP client setup, error handling, retry logic, and rate limiting
 */

import type {
  Provider,
  ProviderConfig,
  ProviderCapabilities,
  ProviderStatus,
  Message,
  ChatOptions,
  ChatResponse,
  StreamChunk,
} from './types.js';
import { ProviderError } from './types.js';

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryableErrors: string[];
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', '429', '503', '502'],
};

/**
 * Rate limiter configuration
 */
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * Simple rate limiter using token bucket algorithm
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(private readonly config: RateLimitConfig) {
    this.tokens = config.maxRequests;
    this.lastRefill = Date.now();
  }

  /**
   * Try to acquire a token for making a request
   */
  async acquire(): Promise<void> {
    this.refill();
    
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    // Calculate wait time
    const waitTime = Math.ceil(this.config.windowMs / this.config.maxRequests);
    await this.sleep(waitTime);
    return this.acquire();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    
    if (elapsed >= this.config.windowMs) {
      this.tokens = this.config.maxRequests;
      this.lastRefill = now;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Abstract base provider class
 */
export abstract class BaseProvider implements Provider {
  abstract readonly name: string;
  abstract readonly type: ProviderConfig['type'];
  abstract readonly capabilities: ProviderCapabilities;
  abstract readonly config: ProviderConfig;

  private readonly rateLimiter: RateLimiter;
  private readonly retryConfig: RetryConfig;
  protected readonly logger = console;

  constructor(
    _config: ProviderConfig,
    rateLimitConfig?: RateLimitConfig,
    retryConfig?: Partial<RetryConfig>
  ) {
    this.rateLimiter = new RateLimiter(
      rateLimitConfig ?? { maxRequests: 60, windowMs: 60000 }
    );
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Send a chat completion request
   */
  abstract chat(messages: readonly Message[], options?: ChatOptions): Promise<ChatResponse>;

  /**
   * Send a streaming chat completion request
   */
  abstract stream?(messages: readonly Message[], options?: ChatOptions): AsyncIterable<StreamChunk>;

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.getHealth();
      return health.available;
    } catch {
      return false;
    }
  }

  /**
   * Get provider health status
   */
  abstract getHealth(): Promise<ProviderStatus>;

  /**
   * Get available models
   */
  getModels(): readonly string[] {
    return this.config.models ?? [];
  }

  /**
   * Make an HTTP request with retry logic and rate limiting
   */
  protected async request<T>(
    requestFn: () => Promise<T>,
    context?: string
  ): Promise<T> {
    await this.rateLimiter.acquire();

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        const shouldRetry = this.shouldRetry(lastError);
        
        if (!shouldRetry || attempt === this.retryConfig.maxRetries) {
          throw this.wrapError(lastError, context);
        }

        const delay = this.calculateDelay(attempt);
        this.logger.warn(
          `[${this.name}] Request failed (attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1}), ` +
          `retrying in ${delay}ms: ${lastError.message}`
        );

        await this.sleep(delay);
      }
    }

    throw this.wrapError(lastError ?? new Error('Unknown error'), context);
  }

  /**
   * Determine if an error should trigger a retry
   */
  private shouldRetry(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    const errorCode = (error as NodeJS.ErrnoException).code ?? '';
    const statusCode = (error as { statusCode?: number }).statusCode?.toString() ?? '';

    return this.retryConfig.retryableErrors.some(
      retryable => 
        errorMessage.includes(retryable.toLowerCase()) ||
        errorCode === retryable ||
        statusCode === retryable
    );
  }

  /**
   * Calculate delay for exponential backoff
   */
  private calculateDelay(attempt: number): number {
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(2, attempt),
      this.retryConfig.maxDelay
    );
    // Add jitter (±10%)
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return Math.floor(delay + jitter);
  }

  /**
   * Wrap an error in a ProviderError
   */
  private wrapError(error: Error, context?: string): ProviderError {
    if (error instanceof ProviderError) {
      return error;
    }

    const statusCode = (error as { statusCode?: number }).statusCode;
    const code = (error as NodeJS.ErrnoException).code ?? 'UNKNOWN';
    
    return new ProviderError(
      `${context ? `${context}: ` : ''}${error.message}`,
      this.name,
      code,
      statusCode,
      this.shouldRetry(error)
    );
  }

  /**
   * Sleep utility
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Build headers for HTTP request
   */
  protected buildHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };

    // Add authentication headers
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    } else if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    } else if (this.config.cookie) {
      headers['Cookie'] = this.config.cookie;
    }

    // Add custom headers from config
    if (this.config.headers) {
      Object.assign(headers, this.config.headers);
    }

    return headers;
  }

  /**
   * Get the base URL for the provider
   */
  protected getBaseUrl(): string {
    return this.config.baseUrl ?? this.getDefaultBaseUrl();
  }

  /**
   * Get default base URL for the provider
   */
  protected abstract getDefaultBaseUrl(): string;

  /**
   * Get the default model for the provider
   */
  protected getDefaultModel(): string {
    return this.config.defaultModel ?? this.getModels()[0] ?? 'default';
  }

  /**
   * Merge options with defaults
   */
  protected mergeOptions(options?: ChatOptions): {
    model: string;
    temperature: number;
    maxTokens: number;
    stop: string[] | undefined;
    topP: number;
    presencePenalty: number;
    frequencyPenalty: number;
    stream: boolean;
  } {
    return {
      model: options?.model ?? this.getDefaultModel(),
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 4096,
      stop: options?.stop ? [...options.stop] : undefined,
      topP: options?.topP ?? 1,
      presencePenalty: options?.presencePenalty ?? 0,
      frequencyPenalty: options?.frequencyPenalty ?? 0,
      stream: options?.stream ?? false,
    };
  }

  /**
   * Convert messages to OpenAI format
   */
  protected formatMessages(messages: readonly Message[]): Array<{ role: string; content: string | unknown[] }> {
    return messages.map(msg => {
      if (typeof msg.content === 'string') {
        return { role: msg.role, content: msg.content };
      }

      // Handle multimodal content
      const content = msg.content.map(part => {
        if (part.type === 'text') {
          return { type: 'text', text: part.text };
        }
        if (part.type === 'image' && part.imageUrl) {
          return {
            type: 'image_url',
            image_url: { url: part.imageUrl.url },
          };
        }
        return part;
      });

      return { role: msg.role, content };
    });
  }

  /**
   * Measure latency for health checks
   */
  protected async measureLatency<T>(fn: () => Promise<T>): Promise<{ result: T; latency: number }> {
    const start = Date.now();
    const result = await fn();
    const latency = Date.now() - start;
    return { result, latency };
  }
}

/**
 * OpenAI-compatible provider base class
 * For providers that implement OpenAI-compatible APIs
 */
export abstract class OpenAICompatibleProvider extends BaseProvider {
  /**
   * Make a chat completion request to an OpenAI-compatible endpoint
   */
  async chat(messages: readonly Message[], options?: ChatOptions): Promise<ChatResponse> {
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
          presence_penalty: mergedOptions.presencePenalty,
          frequency_penalty: mergedOptions.frequencyPenalty,
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

      const data = await response.json() as OpenAIChatResponse;
      
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
  async *stream(messages: readonly Message[], options?: ChatOptions): AsyncIterable<StreamChunk> {
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
        presence_penalty: mergedOptions.presencePenalty,
        frequency_penalty: mergedOptions.frequencyPenalty,
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
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          
          if (!trimmed || trimmed === 'data: [DONE]') {
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6)) as OpenAIStreamResponse;
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

      // Signal completion
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
      const { latency } = await this.measureLatency(async () => {
        // Try a minimal request to check health
        const response = await fetch(`${this.getBaseUrl()}/v1/models`, {
          method: 'GET',
          headers: this.buildHeaders(),
          signal: this.createAbortSignal(5000), // 5 second timeout for health check
        });

        if (!response.ok && response.status !== 404) {
          // 404 is acceptable - some providers don't implement /v1/models
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

  /**
   * Create an abort signal with timeout
   */
  protected createAbortSignal(timeoutMs?: number): AbortSignal {
    const timeout = timeoutMs ?? this.config.timeout ?? 30000;
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeout);
    return controller.signal;
  }
}

/**
 * OpenAI chat response type
 */
interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI stream response type
 */
interface OpenAIStreamResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

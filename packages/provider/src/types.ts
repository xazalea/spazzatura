/**
 * Provider types for LLM abstraction layer
 * Extended types for multi-provider support with failover
 */

import type { StreamChunk as CoreStreamChunk } from '@spazzatura/core';

// Re-export core types
export type {
  ProviderType,
  MessageRole,
  ChatMessage,
  ToolCall,
  ProviderHealth,
} from '@spazzatura/core';

// Re-export StreamChunk with our extended definition
export type StreamChunk = CoreStreamChunk;

/**
 * Extended provider types including free providers
 */
export type ExtendedProviderType =
  | 'minimax'
  | 'qwen'
  | 'gpt4free'
  | 'glm'
  | 'openai'
  | 'anthropic'
  | 'openrouter'
  | 'ollama'
  | 'custom'
  | 'chat2api'
  | 'claude-free'
  | 'webai'
  | 'aiclient'
  | 'freeglm'
  | 'glm-free'
  | 'gpt4free-enhanced'
  | 'free-gpt4-web'
  | 'glm-free-xiaoY';

/**
 * Content part for multimodal messages
 */
export interface ContentPart {
  readonly type: 'text' | 'image';
  readonly text?: string;
  readonly imageUrl?: { readonly url: string };
}

/**
 * Extended message structure supporting multimodal content
 */
export interface Message {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string | readonly ContentPart[];
  readonly name?: string;
}

/**
 * Tool definition for function/tool calling
 */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: {
    readonly type: 'object';
    readonly properties: Record<string, {
      readonly type: string;
      readonly description?: string;
      readonly enum?: string[];
    }>;
    readonly required?: string[];
  };
}

/**
 * Tool call result from LLM response
 */
export interface ToolCallResult {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

/**
 * Chat options for requests
 */
export interface ChatOptions {
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly stop?: readonly string[];
  readonly topP?: number;
  readonly presencePenalty?: number;
  readonly frequencyPenalty?: number;
  readonly stream?: boolean;
  /** Tools available for function calling */
  readonly tools?: readonly ToolDefinition[];
  /** Tool choice: 'auto', 'none', or specific tool name */
  readonly toolChoice?: 'auto' | 'none' | string;
}

/**
 * Chat response from provider
 */
export interface ChatResponse {
  readonly content: string;
  readonly model: string;
  readonly usage?: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens?: number;
  };
  readonly finishReason?: string;
  /** Tool calls requested by the model */
  readonly toolCalls?: readonly ToolCallResult[];
}

/**
 * Extended provider capabilities
 */
export interface ProviderCapabilities {
  /** Basic chat completion */
  readonly chat: boolean;
  /** Streaming responses */
  readonly streaming: boolean;
  /** Vision/image understanding */
  readonly vision: boolean;
  /** Text-to-speech */
  readonly tts: boolean;
  /** Speech-to-text */
  readonly stt: boolean;
  /** Image generation */
  readonly imageGeneration: boolean;
  /** Text embeddings */
  readonly embedding: boolean;
  /** Function/tool calling */
  readonly functionCalling: boolean;
  /** Maximum context length */
  readonly maxContextLength: number;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /** Provider name/identifier */
  readonly name: string;
  /** Provider type */
  readonly type: ExtendedProviderType;
  /** Base URL for API */
  readonly baseUrl?: string;
  /** API key for authentication */
  readonly apiKey?: string;
  /** Cookie for web-based authentication */
  readonly cookie?: string;
  /** Token for authentication */
  readonly token?: string;
  /** Default model to use */
  readonly defaultModel?: string;
  /** Available models */
  readonly models?: readonly string[];
  /** Request timeout in milliseconds */
  readonly timeout?: number;
  /** Maximum retries */
  readonly maxRetries?: number;
  /** Whether provider is enabled */
  readonly enabled?: boolean;
  /** Custom headers */
  readonly headers?: Record<string, string>;
}

/**
 * Provider status for health checking
 */
export interface ProviderStatus {
  /** Provider name */
  readonly name: string;
  /** Whether provider is available */
  readonly available: boolean;
  /** Response latency in milliseconds */
  readonly latency?: number;
  /** Error message if unavailable */
  readonly error?: string;
  /** Last check timestamp */
  readonly lastChecked: Date;
  /** Available models */
  readonly models?: readonly string[];
}

/**
 * Routing strategy types
 */
export type RoutingStrategy = 'failover' | 'round-robin' | 'feature-based' | 'least-latency';

/**
 * Feature-based routing configuration
 */
export interface FeatureRouting {
  /** Provider for TTS */
  readonly tts?: string;
  /** Provider for STT */
  readonly stt?: string;
  /** Provider for image generation */
  readonly imageGeneration?: string;
  /** Provider for vision tasks */
  readonly vision?: string;
  /** Provider for embeddings */
  readonly embedding?: string;
}

/**
 * Routing configuration
 */
export interface RoutingConfig {
  /** Routing strategy */
  readonly strategy: RoutingStrategy;
  /** Failover order (for failover strategy) */
  readonly failoverOrder?: readonly string[];
  /** Feature-based routing (for feature-based strategy) */
  readonly featureBased?: FeatureRouting;
  /** Health check interval in milliseconds */
  readonly healthCheckInterval?: number;
  /** Enable automatic failover */
  readonly autoFailover?: boolean;
}

/**
 * Complete provider manager configuration
 */
export interface ProviderManagerConfig {
  /** Provider configurations */
  readonly providers?: Record<string, ProviderConfig>;
  /** Routing configuration */
  readonly routing?: RoutingConfig;
  /** Default provider name */
  readonly defaultProvider?: string;
}

/**
 * Provider interface that all providers must implement
 */
export interface Provider {
  /** Provider name */
  readonly name: string;
  /** Provider type */
  readonly type: ExtendedProviderType;
  /** Provider capabilities */
  readonly capabilities: ProviderCapabilities;
  /** Provider configuration */
  readonly config: ProviderConfig;

  /**
   * Send a chat completion request
   */
  chat(messages: readonly Message[], options?: ChatOptions): Promise<ChatResponse>;

  /**
   * Send a streaming chat completion request
   */
  stream?(messages: readonly Message[], options?: ChatOptions): AsyncIterable<StreamChunk>;

  /**
   * Generate text embeddings
   */
  embed?(text: string): Promise<readonly number[]>;

  /**
   * Check if provider is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get provider health status
   */
  getHealth(): Promise<ProviderStatus>;

  /**
   * Get available models
   */
  getModels(): readonly string[];
}

/**
 * Provider factory function type
 */
export type ProviderFactory = (config: ProviderConfig) => Provider;

/**
 * Error class for provider errors
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code?: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/**
 * Error class for routing errors
 */
export class RoutingError extends Error {
  constructor(
    message: string,
    public readonly attemptedProviders: readonly string[]
  ) {
    super(message);
    this.name = 'RoutingError';
  }
}

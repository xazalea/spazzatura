/**
 * Provider types for LLM abstraction layer
 */

/**
 * Supported LLM providers
 */
export type ProviderType = 
  | 'minimax-free'
  | 'qwen-free'
  | 'gpt4free-ts'
  | 'glm-free'
  | 'openai'
  | 'anthropic'
  | 'custom';

/**
 * Message role types
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Chat message structure
 */
export interface ChatMessage {
  readonly role: MessageRole;
  readonly content: string;
  readonly name?: string;
  readonly toolCallId?: string;
}

/**
 * Tool definition for function calling
 */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

/**
 * Tool call result
 */
export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

/**
 * Streaming response chunk
 */
export interface StreamChunk {
  readonly delta: string;
  readonly done: boolean;
  readonly toolCalls?: readonly ToolCall[];
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  readonly type: ProviderType;
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly model: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly timeout?: number;
}

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
  readonly streaming: boolean;
  readonly functionCalling: boolean;
  readonly vision: boolean;
  readonly extendedThinking: boolean;
  readonly maxContextLength: number;
}

/**
 * Provider health status
 */
export interface ProviderHealth {
  readonly available: boolean;
  readonly latency?: number;
  readonly error?: string;
  readonly lastChecked: Date;
}

/**
 * Provider interface that all providers must implement
 */
export interface IProvider {
  readonly type: ProviderType;
  readonly capabilities: ProviderCapabilities;
  
  chat(messages: readonly ChatMessage[], tools?: readonly ToolDefinition[]): Promise<ChatMessage>;
  chatStream(messages: readonly ChatMessage[], tools?: readonly ToolDefinition[]): AsyncIterable<StreamChunk>;
  checkHealth(): Promise<ProviderHealth>;
}

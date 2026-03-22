/**
 * Agent types for multi-agent orchestration
 * Inspired by oh-my-openagent architecture
 */

import type { ToolCall } from '@spazzatura/core';

// ============================================================================
// JSON Schema Types
// ============================================================================

/**
 * JSON Schema for tool parameters
 */
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  description?: string;
  enum?: string[];
  default?: unknown;
  [key: string]: unknown;
}

// ============================================================================
// Tool Types
// ============================================================================

/**
 * Result of a tool execution
 */
export interface ToolResult {
  /** Whether the tool execution was successful */
  readonly success: boolean;
  /** Output from the tool */
  readonly output: unknown;
  /** Error message if execution failed */
  readonly error?: string;
}

/**
 * Tool definition with execution function
 */
export interface Tool {
  /** Tool name (used in tool calls) */
  readonly name: string;
  /** Tool description for the LLM */
  readonly description: string;
  /** JSON Schema for parameters */
  readonly parameters: JSONSchema;
  /** Execute the tool with given parameters */
  execute(params: Record<string, unknown>): Promise<ToolResult>;
}

/**
 * Built-in tool names
 */
export type BuiltinToolName = 'file' | 'shell' | 'web' | 'code' | 'memory';

// ============================================================================
// Memory Types
// ============================================================================

/**
 * Memory configuration types
 */
export type MemoryType = 'none' | 'buffer' | 'window' | 'summary';

/**
 * Memory configuration
 */
export interface MemoryConfig {
  /** Type of memory to use */
  readonly type: MemoryType;
  /** Maximum size for window/buffer memory */
  readonly maxSize?: number;
  /** Whether to persist memory */
  readonly persist?: boolean;
  /** Persistence path */
  readonly persistPath?: string;
}

/**
 * Memory entry
 */
export interface MemoryEntry {
  /** Message content */
  readonly message: Message;
  /** Timestamp */
  readonly timestamp: Date;
  /** Optional metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Memory interface
 */
export interface IMemory {
  /** Add a message to memory */
  add(message: Message): void;
  /** Get all messages */
  getAll(): readonly Message[];
  /** Clear memory */
  clear(): void;
  /** Get memory size */
  readonly size: number;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * Message role
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Extended message with tool support
 */
export interface Message {
  /** Message role */
  readonly role: MessageRole;
  /** Message content */
  readonly content: string;
  /** Name for tool messages */
  readonly name?: string;
  /** Tool call ID for tool response messages */
  readonly toolCallId?: string;
  /** Tool calls made in this message */
  readonly toolCalls?: readonly ToolCall[];
}

/**
 * Stream event types
 */
export type StreamEventType = 
  | 'message_start'
  | 'content_delta'
  | 'tool_call'
  | 'tool_result'
  | 'message_end'
  | 'error'
  | 'pause'
  | 'resume';

/**
 * Stream event
 */
export interface StreamEvent {
  /** Event type */
  readonly type: StreamEventType;
  /** Event data */
  readonly data?: unknown;
  /** Timestamp */
  readonly timestamp: Date;
}

// ============================================================================
// Model Configuration
// ============================================================================

/**
 * Model configuration
 */
export interface ModelConfig {
  /** Provider name */
  readonly provider: string;
  /** Model identifier */
  readonly model: string;
  /** Temperature for generation */
  readonly temperature?: number;
  /** Maximum tokens to generate */
  readonly maxTokens?: number;
  /** Top-p sampling */
  readonly topP?: number;
  /** Stop sequences */
  readonly stopSequences?: readonly string[];
}

// ============================================================================
// Agent Hooks
// ============================================================================

/**
 * Run context passed to hooks
 */
export interface RunContext {
  /** Agent ID */
  readonly agentId: string;
  /** Run ID */
  readonly runId: string;
  /** Input string */
  readonly input: string;
  /** Current messages */
  readonly messages: readonly Message[];
  /** Start time */
  readonly startTime: Date;
  /** Current iteration */
  readonly iteration: number;
}

/**
 * Agent hooks for extensibility
 */
export interface AgentHooks {
  /** Called before agent run starts */
  beforeRun?: (context: RunContext) => Promise<void> | void;
  /** Called after agent run completes */
  afterRun?: (context: RunContext) => Promise<void> | void;
  /** Called before each tool call */
  beforeToolCall?: (tool: Tool, params: Record<string, unknown>) => Promise<void> | void;
  /** Called after each tool call */
  afterToolCall?: (tool: Tool, result: ToolResult) => Promise<void> | void;
  /** Called for each message */
  onMessage?: (message: Message) => Promise<void> | void;
  /** Called on error */
  onError?: (error: Error) => Promise<void> | void;
}

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Agent ID (auto-generated if not provided) */
  readonly id?: string;
  /** Agent name */
  readonly name: string;
  /** Agent description */
  readonly description?: string;
  /** System prompt */
  readonly systemPrompt: string;
  /** Model configuration */
  readonly model?: Partial<ModelConfig>;
  /** Tools available to the agent */
  readonly tools?: readonly Tool[];
  /** Memory configuration */
  readonly memory?: MemoryConfig;
  /** Maximum iterations for tool calls */
  readonly maxIterations?: number;
  /** Hooks for extensibility */
  readonly hooks?: AgentHooks;
  /** Timeout for execution in milliseconds */
  readonly timeout?: number;
}

// ============================================================================
// Agent Run Types
// ============================================================================

/**
 * Run status
 */
export type RunStatus = 'running' | 'completed' | 'failed' | 'paused';

/**
 * Agent run state
 */
export interface AgentRun {
  /** Run ID */
  readonly id: string;
  /** Agent ID */
  readonly agentId: string;
  /** Input string */
  readonly input: string;
  /** Messages in the conversation */
  readonly messages: Message[];
  /** Tool results by tool call ID */
  readonly toolResults: Map<string, ToolResult>;
  /** Current status */
  readonly status: RunStatus;
  /** Output string */
  readonly output?: string;
  /** Error message if failed */
  readonly error?: string;
  /** Start time */
  readonly startTime: Date;
  /** End time */
  readonly endTime?: Date;
  /** Number of iterations */
  readonly iterations: number;
}

/**
 * Run options
 */
export interface RunOptions {
  /** Override model */
  readonly model?: Partial<ModelConfig>;
  /** Additional context */
  readonly context?: Record<string, unknown>;
  /** Initial messages */
  readonly initialMessages?: readonly Message[];
  /** Timeout override */
  readonly timeout?: number;
  /** Enable streaming */
  readonly stream?: boolean;
}

// ============================================================================
// Orchestration Types
// ============================================================================

/**
 * Orchestration step for sequential execution
 */
export interface OrchestrationStep {
  /** Agent ID to run */
  readonly agentId: string;
  /** Input string or function to generate input from previous output */
  readonly input: string | ((previousOutput: unknown) => string);
  /** Optional condition to check before running */
  readonly condition?: (previousOutput: unknown) => boolean;
  /** Step name for reference */
  readonly name?: string;
}

/**
 * Orchestration result
 */
export interface OrchestrationResult {
  /** Session ID */
  readonly sessionId: string;
  /** Results by agent ID */
  readonly results: Map<string, AgentRun>;
  /** Final output */
  readonly output?: string;
  /** Whether all steps completed successfully */
  readonly success: boolean;
  /** Total duration in milliseconds */
  readonly duration: number;
  /** Error if any */
  readonly error?: string;
}

// ============================================================================
// Agent File Configuration (YAML)
// ============================================================================

/**
 * Agent file configuration for loading from YAML
 */
export interface AgentFileConfig {
  /** Agent name */
  readonly name: string;
  /** Agent description */
  readonly description?: string;
  /** System prompt */
  readonly systemPrompt: string;
  /** Model configuration */
  readonly model?: Partial<ModelConfig>;
  /** Tool names to load */
  readonly tools?: readonly string[];
  /** Memory configuration */
  readonly memory?: MemoryConfig;
  /** Maximum iterations */
  readonly maxIterations?: number;
}

// ============================================================================
// Tool Registry Types
// ============================================================================

/**
 * Tool registry interface
 */
export interface IToolRegistry {
  /** Register a tool */
  register(tool: Tool): void;
  /** Unregister a tool */
  unregister(name: string): void;
  /** Get a tool by name */
  get(name: string): Tool | undefined;
  /** List all registered tools */
  list(): readonly Tool[];
  /** Check if a tool exists */
  has(name: string): boolean;
}

// ============================================================================
// Agent Interface
// ============================================================================

/**
 * Agent interface for type-safe agent references
 */
export interface IAgent {
  /** Agent ID */
  readonly id: string;
  /** Agent name */
  readonly name: string;
  /** Agent configuration */
  readonly config: AgentConfig;
  /** Run the agent */
  run(input: string, options?: RunOptions): Promise<AgentRun>;
  /** Stream the agent execution */
  stream(input: string, options?: RunOptions): AsyncIterable<StreamEvent>;
  /** Pause execution */
  pause(): void;
  /** Resume execution */
  resume(): void;
  /** Stop execution */
  stop(): void;
  /** Add a tool */
  addTool(tool: Tool): void;
  /** Remove a tool */
  removeTool(name: string): void;
  /** Set system prompt */
  setSystemPrompt(prompt: string): void;
  /** Get current state */
  getState(): AgentRun | undefined;
  /** Reset agent state */
  reset(): void;
}

// ============================================================================
// Agent Registry Types
// ============================================================================

/**
 * Agent registry interface
 */
export interface IAgentRegistry {
  /** Register an agent */
  register(agent: IAgent): void;
  /** Unregister an agent */
  unregister(agentId: string): void;
  /** Get an agent by ID */
  get(agentId: string): IAgent | undefined;
  /** List all registered agents */
  list(): readonly IAgent[];
  /** Check if an agent exists */
  has(agentId: string): boolean;
}

// ============================================================================
// Export Types (re-export from core for convenience)
// ============================================================================

export type {
  ChatMessage,
  ToolDefinition,
  ToolCall,
} from '@spazzatura/core';

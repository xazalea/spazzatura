/**
 * Agent types for multi-agent orchestration
 */

import type { ChatMessage, ToolDefinition } from './provider.js';

/**
 * Agent identifier
 */
export type AgentId = string;

/**
 * Orchestration strategy types
 */
export type OrchestrationStrategy = 
  | 'sequential'
  | 'parallel'
  | 'pipeline'
  | 'hierarchical';

/**
 * Agent status
 */
export type AgentStatus = 'idle' | 'running' | 'waiting' | 'completed' | 'failed';

/**
 * Agent configuration
 */
export interface AgentConfig {
  readonly id: AgentId;
  readonly name: string;
  readonly description: string;
  readonly systemPrompt: string;
  readonly tools?: readonly ToolDefinition[];
  readonly model?: string;
  readonly temperature?: number;
  readonly maxIterations?: number;
}

/**
 * Agent state during execution
 */
export interface AgentState {
  readonly id: AgentId;
  readonly status: AgentStatus;
  readonly messages: readonly ChatMessage[];
  readonly currentTask?: string;
  readonly iterations: number;
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly error?: string;
}

/**
 * Agent execution result
 */
export interface AgentResult {
  readonly id: AgentId;
  readonly success: boolean;
  readonly output: string;
  readonly messages: readonly ChatMessage[];
  readonly toolCalls: readonly ToolCallRecord[];
  readonly duration: number;
  readonly error?: string;
}

/**
 * Tool call record for auditing
 */
export interface ToolCallRecord {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
  readonly result?: unknown;
  readonly timestamp: Date;
}

/**
 * Orchestration configuration
 */
export interface OrchestrationConfig {
  readonly strategy: OrchestrationStrategy;
  readonly agents: readonly AgentId[];
  readonly maxConcurrency?: number;
  readonly timeout?: number;
  readonly failFast?: boolean;
}

/**
 * Orchestration execution context
 */
export interface OrchestrationContext {
  readonly sessionId: string;
  readonly input: string;
  readonly agents: Map<AgentId, AgentState>;
  readonly sharedMemory: Map<string, unknown>;
  readonly startTime: Date;
}

/**
 * Agent interface that all agents must implement
 */
export interface IAgent {
  readonly id: AgentId;
  readonly config: AgentConfig;
  
  execute(input: string, context: OrchestrationContext): Promise<AgentResult>;
  getState(): AgentState;
  reset(): void;
}

/**
 * Agent registry interface
 */
export interface IAgentRegistry {
  register(agent: IAgent): void;
  unregister(agentId: AgentId): void;
  get(agentId: AgentId): IAgent | undefined;
  list(): readonly AgentId[];
}

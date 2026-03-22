/**
 * Agent class implementation
 * Core agent with tool execution, memory management, and streaming support
 */

import { randomUUID } from 'crypto';
import type {
  AgentConfig,
  AgentHooks,
  RunOptions,
  Tool,
  ToolResult,
  Message,
  StreamEvent,
  MemoryConfig,
  ModelConfig,
  IAgent,
  AgentRun,
} from './types.js';
import { BufferMemory } from './memory/buffer.js';
import { WindowMemory } from './memory/window.js';
import { SummaryMemory } from './memory/summary.js';
import type { IMemory, RunContext } from './types.js';
import { ToolExecutor } from './executor.js';
import type { Provider, ToolDefinition } from '@spazzatura/provider';

/**
 * Agent state for tracking execution
 */
interface AgentState {
  status: 'running' | 'completed' | 'failed' | 'paused';
  paused: boolean;
  currentRun: AgentRun | undefined;
  abortController: AbortController | undefined;
}

/**
 * Default model configuration
 */
const DEFAULT_MODEL: Partial<ModelConfig> = {
  provider: 'auto',
  model: 'auto',
  temperature: 0.7,
  maxTokens: 8192,
};

/**
 * Agent implementation with tool execution and memory management
 */
export class Agent implements IAgent {
  readonly id: string;
  readonly name: string;
  readonly config: AgentConfig;

  private readonly toolsMap: Map<string, Tool> = new Map();
  private readonly memoryImpl: IMemory;
  private readonly _modelConfig: ModelConfig;
  private readonly maxIterationsValue: number;
  private readonly hooksValue: AgentHooks | undefined;
  private readonly _timeoutValue: number;
  private readonly executor: ToolExecutor;
  private provider: Provider | null = null;

  private state: AgentState = {
    status: 'completed',
    paused: false,
    currentRun: undefined,
    abortController: undefined,
  };

  constructor(config: AgentConfig, provider?: Provider) {
    this.id = config.id ?? randomUUID();
    this.name = config.name;
    this.config = config;

    // Initialize model
    this._modelConfig = {
      ...DEFAULT_MODEL,
      ...config.model,
    } as ModelConfig;

    // Initialize memory
    this.memoryImpl = this.createMemory(config.memory);

    // Initialize tools
    if (config.tools) {
      for (const tool of config.tools) {
        this.toolsMap.set(tool.name, tool);
      }
    }

    // Initialize other settings
    this.maxIterationsValue = config.maxIterations ?? 10;
    this.hooksValue = config.hooks;
    this._timeoutValue = config.timeout ?? 60000; // 1 minute default

    // Initialize executor
    this.executor = new ToolExecutor();
    for (const tool of this.toolsMap.values()) {
      this.executor.registerTool(tool);
    }

    // Store provider reference
    if (provider) {
      this.provider = provider;
    }
  }

  /**
   * Set the provider for this agent (can be set after construction)
   */
  setProvider(provider: Provider): void {
    this.provider = provider;
  }

  /**
   * Get the model configuration
   */
  get modelConfig(): ModelConfig {
    return this._modelConfig;
  }

  /**
   * Get the timeout value
   */
  get timeout(): number {
    return this._timeoutValue;
  }

  /**
   * Run the agent with the given input
   */
  async run(input: string, options?: RunOptions): Promise<AgentRun> {
    const runId = randomUUID();
    const startTime = new Date();

    // Create abort controller for this run
    const abortController = new AbortController();
    this.state.abortController = abortController;

    // Build initial messages
    const initialMessages = options?.initialMessages ? [...options.initialMessages] : [] as Message[];
    const messages: Message[] = [
      {
        role: 'system',
        content: this.config.systemPrompt,
      },
      ...initialMessages,
      {
        role: 'user',
        content: input,
      },
    ];

    // Initialize run state
    let runStatus: 'running' | 'completed' | 'failed' | 'paused' = 'running';
    let runOutput: string | undefined;
    let runError: string | undefined;
    let runEndTime: Date | undefined;
    const toolResults = new Map<string, ToolResult>();
    let iterations = 0;

    this.state.status = 'running';

    // Create run context
    let contextIteration = 0;
    const context: RunContext = {
      agentId: this.id,
      runId,
      input,
      messages,
      startTime,
      iteration: contextIteration,
    };

    try {
      // Call beforeRun hook
      await this.hooksValue?.beforeRun?.(context);

      // Execute agent loop
      let shouldContinue = true;

      while (shouldContinue && iterations < this.maxIterationsValue) {
        // Check for pause/abort
        if (this.state.paused) {
          runStatus = 'paused';
          break;
        }

        if (abortController.signal.aborted) {
          runStatus = 'failed';
          runError = 'Execution aborted';
          break;
        }

        // Update context
        contextIteration = iterations;

        // Process iteration (this would call the LLM in a real implementation)
        const result = await this.executeIteration(messages, {
          ...context,
          iteration: contextIteration,
        });

        // Check if we should continue
        shouldContinue = result.shouldContinue;
        iterations++;
      }

      // Finalize run
      if (runStatus === 'running') {
        runStatus = 'completed';
        runOutput = this.extractOutput(messages);
      }

      runEndTime = new Date();

      // Call afterRun hook
      await this.hooksValue?.afterRun?.(context);

    } catch (error) {
      runStatus = 'failed';
      runError = error instanceof Error ? error.message : String(error);
      runEndTime = new Date();

      // Call error hook
      await this.hooksValue?.onError?.(error instanceof Error ? error : new Error(String(error)));
    }

    this.state.status = runStatus;
    
    // Build and return the run result
    const result: AgentRun = {
      id: runId,
      agentId: this.id,
      input,
      messages,
      toolResults,
      status: runStatus,
      startTime,
      iterations,
    };
    
    if (runOutput !== undefined) {
      (result as { output: string }).output = runOutput;
    }
    if (runError !== undefined) {
      (result as { error: string }).error = runError;
    }
    if (runEndTime !== undefined) {
      (result as { endTime: Date }).endTime = runEndTime;
    }
    
    this.state.currentRun = result;
    return result;
  }

  /**
   * Stream the agent execution
   */
  async *stream(input: string, options?: RunOptions): AsyncIterable<StreamEvent> {
    const runId = randomUUID();
    const startTime = new Date();

    // Create abort controller
    const abortController = new AbortController();
    this.state.abortController = abortController;

    // Initialize messages
    const initialMessages = options?.initialMessages ? [...options.initialMessages] : [] as Message[];
    const messages: Message[] = [
      {
        role: 'system',
        content: this.config.systemPrompt,
      },
      ...initialMessages,
      {
        role: 'user',
        content: input,
      },
    ];

    // Yield start event
    yield {
      type: 'message_start',
      data: { runId, agentId: this.id },
      timestamp: startTime,
    };

    let contextIteration = 0;
    const context: RunContext = {
      agentId: this.id,
      runId,
      input,
      messages,
      startTime,
      iteration: contextIteration,
    };

    try {
      await this.hooksValue?.beforeRun?.(context);

      let iteration = 0;
      while (iteration < this.maxIterationsValue) {
        if (this.state.paused) {
          yield {
            type: 'pause',
            timestamp: new Date(),
          };
          break;
        }

        if (abortController.signal.aborted) {
          yield {
            type: 'error',
            data: 'Execution aborted',
            timestamp: new Date(),
          };
          break;
        }

        // Yield content delta (simulated - real implementation would stream from LLM)
        yield {
          type: 'content_delta',
          data: { iteration },
          timestamp: new Date(),
        };

        // Execute iteration
        const result = await this.executeIteration(messages, {
          ...context,
          iteration: contextIteration,
        });

        // Yield tool events
        if (result.toolCalls.length > 0) {
          for (const tc of result.toolCalls) {
            yield {
              type: 'tool_call',
              data: tc,
              timestamp: new Date(),
            };
          }
        }

        if (result.toolResults.length > 0) {
          for (const tr of result.toolResults) {
            yield {
              type: 'tool_result',
              data: tr,
              timestamp: new Date(),
            };
          }
        }

        if (!result.shouldContinue) {
          break;
        }

        iteration++;
        contextIteration = iteration;
      }

      yield {
        type: 'message_end',
        data: { output: this.extractOutput(messages) },
        timestamp: new Date(),
      };

      await this.hooksValue?.afterRun?.(context);

    } catch (error) {
      yield {
        type: 'error',
        data: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Pause execution
   */
  pause(): void {
    this.state.paused = true;
  }

  /**
   * Resume execution
   */
  resume(): void {
    this.state.paused = false;
  }

  /**
   * Stop execution
   */
  stop(): void {
    this.state.abortController?.abort();
    this.state.status = 'failed';
    this.state.paused = false;
  }

  /**
   * Add a tool
   */
  addTool(tool: Tool): void {
    this.toolsMap.set(tool.name, tool);
    this.executor.registerTool(tool);
  }

  /**
   * Remove a tool
   */
  removeTool(name: string): void {
    this.toolsMap.delete(name);
    this.executor.unregisterTool(name);
  }

  /**
   * Set system prompt
   */
  setSystemPrompt(prompt: string): void {
    (this.config as { systemPrompt: string }).systemPrompt = prompt;
  }

  /**
   * Get current state
   */
  getState(): AgentRun | undefined {
    return this.state.currentRun;
  }

  /**
   * Reset agent state
   */
  reset(): void {
    this.memoryImpl.clear();
    this.state = {
      status: 'completed',
      paused: false,
      currentRun: undefined,
      abortController: undefined,
    };
  }

  /**
   * Create memory based on configuration
   */
  private createMemory(config?: MemoryConfig): IMemory {
    if (!config || config.type === 'none') {
      return new BufferMemory();
    }

    switch (config.type) {
      case 'buffer':
        return new BufferMemory();
      case 'window':
        return new WindowMemory({ maxSize: config.maxSize ?? 20 });
      case 'summary':
        return new SummaryMemory({
          maxRecentMessages: config.maxSize ?? 10,
        });
      default:
        return new BufferMemory();
    }
  }

  /**
   * Build tool definitions from registered tools
   */
  private buildToolDefinitions(): ToolDefinition[] {
    return Array.from(this.toolsMap.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object' as const,
        properties: (tool.parameters.properties ?? {}) as Record<string, {
          type: string;
          description?: string;
          enum?: string[];
        }>,
        required: (tool.parameters.required ?? []) as string[],
      },
    }));
  }

  /**
   * Convert agent messages to provider message format
   */
  private toProviderMessages(messages: Message[]): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    return messages
      .filter(m => m.role === 'system' || m.role === 'user' || m.role === 'assistant')
      .map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      }));
  }

  /**
   * Inject tool schema into system prompt for providers without native function calling
   */
  private injectToolsIntoPrompt(messages: Message[]): Message[] {
    if (this.toolsMap.size === 0) return messages;

    const toolSchema = Array.from(this.toolsMap.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));

    const toolPrompt = `\n\nYou have access to the following tools. To use a tool, respond with a JSON block:\n\`\`\`json\n{"tool": "tool_name", "arguments": {"arg": "value"}}\n\`\`\`\n\nAvailable tools:\n${JSON.stringify(toolSchema, null, 2)}`;

    const systemMsg = messages.find(m => m.role === 'system');
    if (systemMsg) {
      return messages.map(m =>
        m.role === 'system' ? { ...m, content: m.content + toolPrompt } : m
      );
    }

    return [{ role: 'system', content: toolPrompt }, ...messages];
  }

  /**
   * Try to extract tool calls from text response (for providers without native tool calling)
   */
  private extractToolCallsFromText(content: string): Array<{ name: string; arguments: Record<string, unknown> }> {
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
    const jsonBlockRegex = /```json\s*(\{[\s\S]*?\})\s*```/g;
    let match: RegExpExecArray | null;

    while ((match = jsonBlockRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]!) as Record<string, unknown>;
        if (typeof parsed['tool'] === 'string') {
          calls.push({
            name: parsed['tool'],
            arguments: (parsed['arguments'] ?? {}) as Record<string, unknown>,
          });
        }
      } catch {
        // Skip malformed JSON
      }
    }

    return calls;
  }

  /**
   * Execute a single iteration — calls the LLM and processes tool calls
   */
  private async executeIteration(
    messages: Message[],
    _context: RunContext
  ): Promise<{
    shouldContinue: boolean;
    toolCalls: Array<{ name: string; params: Record<string, unknown> }>;
    toolResults: Array<ToolResult>;
  }> {
    const toolCallResults: Array<{ name: string; params: Record<string, unknown> }> = [];
    const toolResults: ToolResult[] = [];

    // Track last message for memory
    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
      this.memoryImpl.add(lastMessage);
      await this.hooksValue?.onMessage?.(lastMessage);
    }

    // If no provider, cannot proceed
    if (!this.provider) {
      return { shouldContinue: false, toolCalls: toolCallResults, toolResults };
    }

    const hasTools = this.toolsMap.size > 0;
    const supportsNativeTools = this.provider.capabilities.functionCalling;

    let responseContent: string;
    let nativeToolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    // Build base chat options (omit undefined values for exactOptionalPropertyTypes)
    const modelName = this._modelConfig.model !== 'auto' ? this._modelConfig.model : undefined;
    const baseOpts = {
      ...(modelName !== undefined ? { model: modelName } : {}),
      ...(this._modelConfig.temperature !== undefined ? { temperature: this._modelConfig.temperature } : {}),
      ...(this._modelConfig.maxTokens !== undefined ? { maxTokens: this._modelConfig.maxTokens } : {}),
    };

    if (hasTools && supportsNativeTools) {
      // Use native function calling
      const providerMessages = this.toProviderMessages(messages);
      const tools = this.buildToolDefinitions();
      const response = await this.provider.chat(providerMessages, { ...baseOpts, tools });
      responseContent = response.content;
      nativeToolCalls = (response.toolCalls ?? []).map(tc => ({
        name: tc.name,
        arguments: tc.arguments,
      }));
    } else if (hasTools) {
      // Inject tools into prompt for providers without native support
      const injectedMessages = this.injectToolsIntoPrompt(messages);
      const providerMessages = this.toProviderMessages(injectedMessages);
      const response = await this.provider.chat(providerMessages, baseOpts);
      responseContent = response.content;
      nativeToolCalls = this.extractToolCallsFromText(responseContent);
    } else {
      // Plain chat — no tools
      const providerMessages = this.toProviderMessages(messages);
      const response = await this.provider.chat(providerMessages, baseOpts);
      responseContent = response.content;
    }

    // Add assistant response to messages
    const assistantMsg: Message = { role: 'assistant', content: responseContent };
    messages.push(assistantMsg);
    this.memoryImpl.add(assistantMsg);
    await this.hooksValue?.onMessage?.(assistantMsg);

    // Process tool calls
    if (nativeToolCalls.length > 0) {
      for (const tc of nativeToolCalls) {
        toolCallResults.push({ name: tc.name, params: tc.arguments });
        await this.hooksValue?.beforeToolCall?.(
          this.toolsMap.get(tc.name)!,
          tc.arguments
        );

        const result = await this.executor.execute(tc.name, tc.arguments);
        toolResults.push(result);

        if (this.toolsMap.has(tc.name)) {
          await this.hooksValue?.afterToolCall?.(this.toolsMap.get(tc.name)!, result);
        }

        // Add tool result to messages
        const toolMsg: Message = {
          role: 'tool',
          content: JSON.stringify(result.output ?? result.error ?? ''),
          name: tc.name,
        };
        messages.push(toolMsg);
        this.memoryImpl.add(toolMsg);
      }

      // Continue the loop to process tool results
      return { shouldContinue: true, toolCalls: toolCallResults, toolResults };
    }

    // No tool calls — conversation is done for this iteration
    return { shouldContinue: false, toolCalls: toolCallResults, toolResults };
  }

  /**
   * Execute a tool call
   * This method can be called directly or during agent execution
   */
  async executeToolCall(
    toolName: string,
    params: Record<string, unknown>,
    _context: RunContext
  ): Promise<ToolResult> {
    const tool = this.toolsMap.get(toolName);
    if (!tool) {
      return {
        success: false,
        output: null,
        error: `Tool not found: ${toolName}`,
      };
    }

    // Call beforeToolCall hook
    await this.hooksValue?.beforeToolCall?.(tool, params);

    // Execute tool
    const result = await this.executor.execute(toolName, params);

    // Call afterToolCall hook
    await this.hooksValue?.afterToolCall?.(tool, result);

    return result;
  }

  /**
   * Extract output from messages
   */
  private extractOutput(messages: Message[]): string {
    // Find the last assistant message
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg && msg.role === 'assistant') {
        return msg.content;
      }
    }
    return '';
  }
}

/**
 * Create an agent with configuration
 */
export function createAgent(config: AgentConfig, provider?: Provider): IAgent {
  return new Agent(config, provider);
}

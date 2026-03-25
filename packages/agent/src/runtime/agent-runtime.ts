/**
 * AgentRuntime — core agentic loop
 *
 * Receives a goal, plans with the LLM via streaming, executes tools, observes
 * results, and repeats until the model signals completion or the step limit is
 * reached.
 */

import type { Provider, ToolDefinition, ChatOptions, StreamChunk } from '@spazzatura/provider';
import type { Tool, ToolResult, Message } from '../types.js';

// ---------------------------------------------------------------------------
// AgentEvent — what the caller sees while the loop is running
// ---------------------------------------------------------------------------

export type AgentEvent =
  | { readonly type: 'thinking'; readonly delta: string }
  | { readonly type: 'tool_call'; readonly id: string; readonly name: string; readonly args: Record<string, unknown> }
  | { readonly type: 'tool_result'; readonly id: string; readonly name: string; readonly result: ToolResult }
  | { readonly type: 'tool_error'; readonly id: string; readonly name: string; readonly error: string }
  | { readonly type: 'step_complete'; readonly step: number; readonly response: string }
  | { readonly type: 'done'; readonly output: string; readonly steps: number; readonly tokensUsed: number }
  | { readonly type: 'error'; readonly message: string };

// ---------------------------------------------------------------------------
// Runtime options
// ---------------------------------------------------------------------------

export interface AgentRuntimeOptions {
  /** Maximum number of agentic loop iterations (default: 20) */
  readonly maxSteps?: number;
  /** System prompt to prepend to every conversation */
  readonly systemPrompt?: string;
  /** Model override passed through to the provider */
  readonly model?: string;
  /** Temperature override */
  readonly temperature?: number;
  /** Max tokens to generate per step */
  readonly maxTokens?: number;
  /** AbortSignal to cancel the run */
  readonly signal?: AbortSignal;
  /** Maximum tool retries on transient failures (default: 2) */
  readonly maxToolRetries?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Sentinel that the model can include in its response to signal it is done. */
const DONE_SENTINEL = '<DONE>';

/** Convert our Tool type into the ToolDefinition expected by Provider.stream */
function toolToDefinition(tool: Tool): ToolDefinition {
  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object' as const,
      properties: (tool.parameters.properties ?? {}) as Record<string, {
        type: string;
        description?: string;
        enum?: string[];
      }>,
      ...(tool.parameters.required ? { required: tool.parameters.required } : {}),
    },
  };
}

/**
 * Collect all streaming chunks from the provider into a single response string
 * and surface pending tool calls.  Returns the full text and any tool-call
 * requests embedded in the stream.
 */
async function* streamResponse(
  provider: Provider,
  messages: readonly Message[],
  options: ChatOptions,
): AsyncGenerator<StreamChunk> {
  // Cast to provider's Message type — both share the same wire shape; the
  // provider type omits 'tool' role, but we send tool results as user messages
  // or pass through when the provider supports it.
  type ProviderMessage = Parameters<Provider['chat']>[0][number];
  const providerMessages = messages as unknown as readonly ProviderMessage[];

  if (!provider.stream) {
    // Fall back to non-streaming if the provider does not support it
    const response = await provider.chat(providerMessages, options);
    const toolCalls = response.toolCalls?.map(tc => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.arguments,
    }));
    if (toolCalls && toolCalls.length > 0) {
      yield { delta: response.content, done: false, toolCalls } as StreamChunk;
    } else {
      yield { delta: response.content, done: false };
    }
    yield { delta: '', done: true };
    return;
  }

  yield* provider.stream(providerMessages, options);
}

// ---------------------------------------------------------------------------
// AgentRuntime
// ---------------------------------------------------------------------------

export class AgentRuntime {
  private readonly provider: Provider;
  private readonly tools: readonly Tool[];
  private readonly options: Required<AgentRuntimeOptions>;

  constructor(provider: Provider, tools: readonly Tool[], options: AgentRuntimeOptions = {}) {
    this.provider = provider;
    this.tools = tools;
    this.options = {
      maxSteps: options.maxSteps ?? 20,
      systemPrompt: options.systemPrompt ?? 'You are a helpful AI assistant with access to tools. When you have completed the user\'s request, include <DONE> in your response.',
      model: options.model ?? '',
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 8192,
      signal: options.signal ?? new AbortController().signal,
      maxToolRetries: options.maxToolRetries ?? 2,
    };
  }

  /**
   * Run the agentic loop for the given goal.
   * Yields AgentEvents as the loop progresses.
   */
  async *run(goal: string): AsyncGenerator<AgentEvent> {
    const { maxSteps, systemPrompt, model, temperature, maxTokens, signal, maxToolRetries } = this.options;

    // Build a lookup map for tools
    const toolMap = new Map<string, Tool>(this.tools.map(t => [t.name, t]));
    const toolDefinitions: ToolDefinition[] = this.tools.map(toolToDefinition);

    // Conversation history
    const messages: Message[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: goal });

    let totalTokensUsed = 0;
    let step = 0;
    let finalOutput = '';

    for (step = 0; step < maxSteps; step++) {
      if (signal.aborted) {
        yield { type: 'error', message: 'Run cancelled by caller.' };
        return;
      }

      // -----------------------------------------------------------------------
      // Step: call the LLM with streaming
      // -----------------------------------------------------------------------
      const chatOptions: ChatOptions = {
        ...(model ? { model } : {}),
        temperature,
        maxTokens,
        ...(toolDefinitions.length > 0 ? { tools: toolDefinitions, toolChoice: 'auto' as const } : {}),
      };

      let stepText = '';
      const pendingToolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];

      try {
        for await (const chunk of streamResponse(this.provider, messages, chatOptions)) {
          if (signal.aborted) {
            yield { type: 'error', message: 'Run cancelled by caller.' };
            return;
          }

          if (chunk.delta) {
            stepText += chunk.delta;
            yield { type: 'thinking', delta: chunk.delta };
          }

          if (chunk.toolCalls) {
            for (const tc of chunk.toolCalls) {
              pendingToolCalls.push({
                id: tc.id,
                name: tc.name,
                arguments: tc.arguments,
              });
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        yield { type: 'error', message: `LLM error on step ${step + 1}: ${message}` };
        return;
      }

      // Rough token counting — providers may not expose usage in streaming mode
      totalTokensUsed += Math.ceil((stepText.length + goal.length) / 4);

      // -----------------------------------------------------------------------
      // No tool calls — check if we are done
      // -----------------------------------------------------------------------
      if (pendingToolCalls.length === 0) {
        finalOutput = stepText;
        yield { type: 'step_complete', step: step + 1, response: stepText };

        // The model signals completion via the sentinel or we treat the last
        // response as the final answer.
        if (stepText.includes(DONE_SENTINEL) || step === maxSteps - 1) {
          const cleanOutput = stepText.replace(DONE_SENTINEL, '').trim();
          finalOutput = cleanOutput;
          break;
        }

        // No tool calls and no done — push assistant response and continue
        messages.push({ role: 'assistant', content: stepText });
        continue;
      }

      // -----------------------------------------------------------------------
      // Execute tool calls
      // -----------------------------------------------------------------------
      messages.push({ role: 'assistant', content: stepText });

      for (const tc of pendingToolCalls) {
        if (signal.aborted) {
          yield { type: 'error', message: 'Run cancelled by caller.' };
          return;
        }

        yield { type: 'tool_call', id: tc.id, name: tc.name, args: tc.arguments };

        const tool = toolMap.get(tc.name);
        if (!tool) {
          const errMsg = `Tool "${tc.name}" is not registered.`;
          yield { type: 'tool_error', id: tc.id, name: tc.name, error: errMsg };
          messages.push({
            role: 'tool',
            content: JSON.stringify({ error: errMsg }),
            name: tc.name,
            toolCallId: tc.id,
          });
          continue;
        }

        // Retry loop for transient errors
        let lastError: string | undefined;
        let result: ToolResult | undefined;
        for (let attempt = 0; attempt <= maxToolRetries; attempt++) {
          try {
            result = await tool.execute(tc.arguments);
            lastError = undefined;
            break;
          } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
            if (attempt < maxToolRetries) {
              // brief back-off before retry
              await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
            }
          }
        }

        if (lastError !== undefined || result === undefined) {
          const errMsg = lastError ?? 'Unknown tool error';
          yield { type: 'tool_error', id: tc.id, name: tc.name, error: errMsg };
          messages.push({
            role: 'tool',
            content: JSON.stringify({ error: errMsg }),
            name: tc.name,
            toolCallId: tc.id,
          });
          continue;
        }

        yield { type: 'tool_result', id: tc.id, name: tc.name, result };

        const toolResultContent = result.success
          ? JSON.stringify(result.output)
          : JSON.stringify({ error: result.error });

        messages.push({
          role: 'tool',
          content: toolResultContent,
          name: tc.name,
          toolCallId: tc.id,
        });
      }

      yield { type: 'step_complete', step: step + 1, response: stepText };
    }

    yield {
      type: 'done',
      output: finalOutput,
      steps: step + 1,
      tokensUsed: totalTokensUsed,
    };
  }
}

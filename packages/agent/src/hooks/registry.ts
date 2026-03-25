/**
 * Hook registry for the Spazzatura agent system.
 *
 * Ported from oh-my-openagent plugin hook architecture.
 * Provides an EventEmitter-style registry for cross-cutting concerns:
 *   - chat.message  — fired on each incoming chat message
 *   - tool.before   — fired before a tool call executes
 *   - tool.after    — fired after a tool call completes
 *   - system.transform — fired to transform/augment system prompts
 *   - chat.params   — fired to override model/params per message
 */

// ============================================================================
// Hook Types
// ============================================================================

/**
 * All supported hook event types.
 */
export type HookType =
  | 'chat.message'
  | 'tool.before'
  | 'tool.after'
  | 'system.transform'
  | 'chat.params';

/**
 * Payloads for each hook type.
 * Handlers receive the payload and may mutate it in place or return a new one.
 */
export interface HookPayloads {
  'chat.message': ChatMessagePayload;
  'tool.before': ToolBeforePayload;
  'tool.after': ToolAfterPayload;
  'system.transform': SystemTransformPayload;
  'chat.params': ChatParamsPayload;
}

export interface ChatMessagePayload {
  sessionId: string;
  agentName?: string;
  model?: { providerID: string; modelID: string };
  parts: Array<{ type: string; text?: string; [key: string]: unknown }>;
  message: Record<string, unknown>;
}

export interface ToolBeforePayload {
  sessionId: string;
  toolName: string;
  params: Record<string, unknown>;
}

export interface ToolAfterPayload {
  sessionId: string;
  toolName: string;
  params: Record<string, unknown>;
  result: unknown;
  error?: Error;
}

export interface SystemTransformPayload {
  sessionId: string;
  /** Mutable list of system prompt segments; append to extend the prompt */
  system: string[];
}

export interface ChatParamsPayload {
  sessionId: string;
  agentName?: string;
  params: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    [key: string]: unknown;
  };
}

// ============================================================================
// Handler type
// ============================================================================

export type HookHandler<T extends HookType> = (
  payload: HookPayloads[T],
) => Promise<HookPayloads[T] | void> | HookPayloads[T] | void;

// ============================================================================
// HookRegistry
// ============================================================================

/**
 * Registry for agent lifecycle hooks.
 *
 * Hooks are fired in registration order. Each handler may mutate the payload
 * (or return a new one). The final payload is returned from `fire()`.
 *
 * @example
 * ```ts
 * hookRegistry.register('chat.message', async (payload) => {
 *   payload.message['myField'] = 'injected';
 * });
 *
 * const result = await hookRegistry.fire('chat.message', initialPayload);
 * ```
 */
export class HookRegistry {
  private readonly handlers = new Map<HookType, HookHandler<HookType>[]>();

  // --------------------------------------------------------------------------
  // Registration
  // --------------------------------------------------------------------------

  /**
   * Register a handler for the given hook type.
   * Returns a function that unregisters the handler when called.
   */
  register<T extends HookType>(type: T, handler: HookHandler<T>): () => void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as unknown as HookHandler<HookType>);
    this.handlers.set(type, list);

    return () => {
      const current = this.handlers.get(type);
      if (!current) return;
      const index = current.indexOf(handler as unknown as HookHandler<HookType>);
      if (index !== -1) current.splice(index, 1);
    };
  }

  /**
   * Remove all handlers for a given hook type.
   */
  clear(type: HookType): void {
    this.handlers.delete(type);
  }

  /**
   * Remove all handlers for all hook types.
   */
  clearAll(): void {
    this.handlers.clear();
  }

  // --------------------------------------------------------------------------
  // Firing
  // --------------------------------------------------------------------------

  /**
   * Fire all registered handlers for the given hook type in sequence.
   *
   * Each handler may return a new payload (replacing the current one) or
   * mutate the existing payload in place (returning void). Either style works.
   *
   * @returns The (potentially mutated) final payload after all handlers run.
   */
  async fire<T extends HookType>(
    type: T,
    payload: HookPayloads[T],
  ): Promise<HookPayloads[T]> {
    const list = this.handlers.get(type) as HookHandler<T>[] | undefined;
    if (!list || list.length === 0) return payload;

    let current = payload;
    for (const handler of list) {
      try {
        const result = await handler(current);
        if (result !== undefined && result !== null) {
          current = result as HookPayloads[T];
        }
      } catch (err) {
        // Hooks must not crash the pipeline; log and continue
        console.error(`[HookRegistry] Error in ${type} handler:`, err);
      }
    }
    return current;
  }

  // --------------------------------------------------------------------------
  // Introspection
  // --------------------------------------------------------------------------

  /**
   * Returns the number of registered handlers for a given type.
   */
  handlerCount(type: HookType): number {
    return this.handlers.get(type)?.length ?? 0;
  }

  /**
   * Returns true if any handlers are registered for the given type.
   */
  has(type: HookType): boolean {
    return (this.handlers.get(type)?.length ?? 0) > 0;
  }
}

// ============================================================================
// Singleton
// ============================================================================

/**
 * Singleton hook registry for the Spazzatura agent system.
 *
 * Import this in hooks and plugins to register handlers without
 * dependency injection.
 */
export const hookRegistry = new HookRegistry();

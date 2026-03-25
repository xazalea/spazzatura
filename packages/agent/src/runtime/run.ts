/**
 * Top-level convenience API: runAgent(goal, opts)
 *
 * Auto-selects a provider via ProviderManager (env-based) and runs the
 * agentic loop, yielding AgentEvents until the run completes.
 */

import { ProviderManager } from '@spazzatura/provider';
import { AgentRuntime, type AgentEvent, type AgentRuntimeOptions } from './agent-runtime.js';
import type { Tool } from '../types.js';
import type { Provider } from '@spazzatura/provider';

// ---------------------------------------------------------------------------
// runAgent options
// ---------------------------------------------------------------------------

export interface RunAgentOptions extends AgentRuntimeOptions {
  /**
   * Explicit provider instance.  When omitted, ProviderManager.fromEnv() is
   * used to auto-select the first available provider.
   */
  readonly provider?: Provider;
  /**
   * Tools to expose to the agent.  Defaults to an empty set.
   */
  readonly tools?: readonly Tool[];
}

// ---------------------------------------------------------------------------
// runAgent
// ---------------------------------------------------------------------------

/**
 * Convenience wrapper that sets up the provider and runs the agentic loop.
 *
 * @example
 * ```ts
 * for await (const event of runAgent('List all TypeScript files', { tools: [globTool] })) {
 *   if (event.type === 'thinking') process.stdout.write(event.delta);
 *   if (event.type === 'done') console.log('\nFinal:', event.output);
 * }
 * ```
 */
export async function* runAgent(
  goal: string,
  opts: RunAgentOptions = {},
): AsyncGenerator<AgentEvent> {
  const { provider: explicitProvider, tools = [], ...runtimeOpts } = opts;

  // Resolve provider
  let provider: Provider;
  if (explicitProvider) {
    provider = explicitProvider;
  } else {
    const manager = ProviderManager.fromEnv();
    const candidate = manager.getDefaultProvider();
    if (!candidate) {
      yield {
        type: 'error',
        message:
          'No provider available. Configure at least one provider via environment variables (e.g. OPENAI_API_KEY) or pass an explicit provider.',
      };
      return;
    }
    provider = candidate;
  }

  const runtime = new AgentRuntime(provider, tools, runtimeOpts);
  yield* runtime.run(goal);
}

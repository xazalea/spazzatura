/**
 * Claude Free Provider — delegates to ClaudeFreeNativeProvider (claude.ai cookie SSE).
 * Auth: CLAUDE_FREE_COOKIE env var (set by `spaz auth claude`).
 */

import { ClaudeFreeNativeProvider } from './native/index.js';
import { getDefaultCapabilities } from '../config.js';
import type {
  Provider,
  ProviderConfig,
  ProviderCapabilities,
  ProviderStatus,
  Message,
  ChatOptions,
  StreamChunk,
} from '../types.js';

export interface ClaudeFreeConfig extends ProviderConfig {
  type: 'claude-free';
}

export class ClaudeFreeProvider implements Provider {
  readonly name = 'claude-free';
  readonly type = 'claude-free' as const;
  readonly capabilities: ProviderCapabilities;
  readonly config: ProviderConfig;

  private native = new ClaudeFreeNativeProvider();

  constructor(config: Partial<ClaudeFreeConfig> = {}) {
    this.config = {
      name: 'claude-free',
      type: 'claude-free',
      models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-2.1'],
      defaultModel: 'claude-3-5-sonnet-20241022',
      timeout: 60000,
      maxRetries: 2,
      enabled: config.enabled ?? true,
      ...config,
    };
    this.capabilities = getDefaultCapabilities('claude-free');
  }

  getModels(): string[] {
    return this.config.models ?? ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-2.1'];
  }

  async *stream(messages: readonly Message[], options?: ChatOptions): AsyncIterable<StreamChunk> {
    const nativeMsgs = messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }));
    const model = options?.model ?? this.config.defaultModel;
    for await (const delta of this.native.stream(nativeMsgs, { model })) {
      yield { delta, done: false };
    }
    yield { delta: '', done: true };
  }

  async getHealth(): Promise<ProviderStatus> {
    const configured = !!process.env['CLAUDE_FREE_COOKIE'];
    return {
      name: this.name,
      available: configured,
      error: configured ? undefined : 'CLAUDE_FREE_COOKIE not set',
      lastChecked: new Date(),
      models: this.getModels(),
    };
  }
}

export function createClaudeFreeProvider(config?: Partial<ClaudeFreeConfig>): ClaudeFreeProvider {
  return new ClaudeFreeProvider(config);
}

export const claudeFreeProvider = new ClaudeFreeProvider();

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
  ChatResponse,
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
    return [...(this.config.models ?? ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-2.1'])];
  }

  async chat(messages: readonly Message[], options?: ChatOptions): Promise<ChatResponse> {
    let content = '';
    for await (const chunk of this.stream(messages, options)) {
      if (!chunk.done) content += chunk.delta;
    }
    return { content, model: options?.model ?? 'claude-3-5-sonnet-20241022' };
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env['CLAUDE_FREE_COOKIE'];
  }

  async *stream(messages: readonly Message[], options?: ChatOptions): AsyncIterable<StreamChunk> {
    const nativeMsgs = messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: typeof m.content === 'string' ? m.content : '' }));
    const model = options?.model ?? this.config.defaultModel ?? 'claude-3-5-sonnet-20241022';
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
      lastChecked: new Date(),
      models: this.getModels(),
      ...(configured ? {} : { error: 'CLAUDE_FREE_COOKIE not set' }),
    };
  }
}

export function createClaudeFreeProvider(config?: Partial<ClaudeFreeConfig>): ClaudeFreeProvider {
  return new ClaudeFreeProvider(config);
}

export const claudeFreeProvider = new ClaudeFreeProvider();

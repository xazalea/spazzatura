/**
 * MiniMax Provider — delegates to MiniMaxNativeProvider (direct HTTP/2 to hailuoai.com).
 * Auth: MINIMAX_COOKIE env var (token, set by `spaz auth minimax`).
 */

import { MiniMaxNativeProvider } from './native/index.js';
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

export interface MiniMaxConfig extends ProviderConfig {
  type: 'minimax';
}

export class MiniMaxProvider implements Provider {
  readonly name = 'minimax';
  readonly type = 'minimax' as const;
  readonly capabilities: ProviderCapabilities;
  readonly config: ProviderConfig;

  private native = new MiniMaxNativeProvider();

  constructor(config: Partial<MiniMaxConfig> = {}) {
    this.config = {
      name: 'minimax',
      type: 'minimax',
      models: ['hailuo', 'MiniMax-Text-01'],
      defaultModel: 'hailuo',
      timeout: 60000,
      maxRetries: 2,
      enabled: config.enabled ?? true,
      ...config,
    };
    this.capabilities = getDefaultCapabilities('minimax');
  }

  getModels(): string[] {
    return this.config.models ?? ['hailuo', 'MiniMax-Text-01'];
  }

  async *stream(messages: readonly Message[], _options?: ChatOptions): AsyncIterable<StreamChunk> {
    const nativeMsgs = messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }));
    for await (const delta of this.native.stream(nativeMsgs)) {
      yield { delta, done: false };
    }
    yield { delta: '', done: true };
  }

  async getHealth(): Promise<ProviderStatus> {
    const configured = !!process.env['MINIMAX_COOKIE'];
    return {
      name: this.name,
      available: configured,
      error: configured ? undefined : 'MINIMAX_COOKIE not set',
      lastChecked: new Date(),
      models: this.getModels(),
    };
  }
}

export function createMiniMaxProvider(config?: Partial<MiniMaxConfig>): MiniMaxProvider {
  return new MiniMaxProvider(config);
}

export const minimaxProvider = new MiniMaxProvider();

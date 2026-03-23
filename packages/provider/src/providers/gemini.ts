/**
 * Gemini Provider — delegates to GeminiNativeProvider (gemini.google.com cookie-based).
 * Auth: GEMINI_COOKIE env var (set by `spaz auth gemini`).
 */

import { GeminiNativeProvider } from './native/index.js';
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

export interface GeminiConfig extends ProviderConfig {
  type: 'gemini';
}

export class GeminiProvider implements Provider {
  readonly name = 'gemini';
  readonly type = 'gemini' as const;
  readonly capabilities: ProviderCapabilities;
  readonly config: ProviderConfig;

  private native = new GeminiNativeProvider();

  constructor(config: Partial<GeminiConfig> = {}) {
    this.config = {
      name: 'gemini',
      type: 'gemini',
      models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
      defaultModel: 'gemini-2.0-flash',
      timeout: 60000,
      maxRetries: 2,
      enabled: config.enabled ?? true,
      ...config,
    };
    this.capabilities = getDefaultCapabilities('gemini');
  }

  getModels(): string[] {
    return this.config.models ?? ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
  }

  async *stream(messages: readonly Message[], _options?: ChatOptions): AsyncIterable<StreamChunk> {
    const nativeMsgs = messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }));
    for await (const delta of this.native.stream(nativeMsgs)) {
      yield { delta, done: false };
    }
    yield { delta: '', done: true };
  }

  async getHealth(): Promise<ProviderStatus> {
    const configured = !!process.env['GEMINI_COOKIE'];
    return {
      name: this.name,
      available: configured,
      error: configured ? undefined : 'GEMINI_COOKIE not set',
      lastChecked: new Date(),
      models: this.getModels(),
    };
  }
}

export function createGeminiProvider(config?: Partial<GeminiConfig>): GeminiProvider {
  return new GeminiProvider(config);
}

export const geminiProvider = new GeminiProvider();

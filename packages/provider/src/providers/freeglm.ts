/**
 * FreeGLM Provider — delegates to FreeGLMNativeProvider (v8.qqslyx.com, no auth).
 */

import { FreeGLMNativeProvider } from './native/index.js';
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

export interface FreeGLMConfig extends ProviderConfig {
  type: 'freeglm';
}

export class FreeGLMProvider implements Provider {
  readonly name = 'freeglm';
  readonly type = 'freeglm' as const;
  readonly capabilities: ProviderCapabilities;
  readonly config: ProviderConfig;

  private native = new FreeGLMNativeProvider();

  constructor(config: Partial<FreeGLMConfig> = {}) {
    this.config = {
      name: 'freeglm',
      type: 'freeglm',
      models: ['glm-4-flash', 'glm-4-air', 'glm-4', 'glm-4-airx'],
      defaultModel: 'glm-4-flash',
      timeout: 30000,
      maxRetries: 3,
      enabled: config.enabled ?? true,
      ...config,
    };
    this.capabilities = getDefaultCapabilities('freeglm');
  }

  getModels(): string[] {
    return this.config.models ?? ['glm-4-flash', 'glm-4-air', 'glm-4', 'glm-4-airx'];
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
    return {
      name: this.name,
      available: true, // no auth required
      lastChecked: new Date(),
      models: this.getModels(),
    };
  }
}

export function createFreeGLMProvider(config?: Partial<FreeGLMConfig>): FreeGLMProvider {
  return new FreeGLMProvider(config);
}

export const freeglmProvider = new FreeGLMProvider();

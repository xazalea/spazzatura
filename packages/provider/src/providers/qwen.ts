/**
 * Qwen Provider — delegates to QwenNativeProvider (direct HTTP to aliyun.com).
 * Auth: QWEN_COOKIE env var (set by `spaz auth qwen`).
 */

import { QwenNativeProvider } from './native/index.js';
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

export interface QwenConfig extends ProviderConfig {
  type: 'qwen';
}

export class QwenProvider implements Provider {
  readonly name = 'qwen';
  readonly type = 'qwen' as const;
  readonly capabilities: ProviderCapabilities;
  readonly config: ProviderConfig;

  private native = new QwenNativeProvider();

  constructor(config: Partial<QwenConfig> = {}) {
    this.config = {
      name: 'qwen',
      type: 'qwen',
      models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
      defaultModel: 'qwen-turbo',
      timeout: 30000,
      maxRetries: 3,
      enabled: config.enabled ?? true,
      ...config,
    };
    this.capabilities = getDefaultCapabilities('qwen');
  }

  getModels(): string[] {
    return this.config.models ?? ['qwen-turbo', 'qwen-plus', 'qwen-max'];
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
    const configured = !!process.env['QWEN_COOKIE'];
    return {
      name: this.name,
      available: configured,
      error: configured ? undefined : 'QWEN_COOKIE not set',
      lastChecked: new Date(),
      models: this.getModels(),
    };
  }
}

export function createQwenProvider(config?: Partial<QwenConfig>): QwenProvider {
  return new QwenProvider(config);
}

export const qwenProvider = new QwenProvider();

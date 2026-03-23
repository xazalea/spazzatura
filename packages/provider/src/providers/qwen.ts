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
  ChatResponse,
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
    return [...(this.config.models ?? ['qwen-turbo', 'qwen-plus', 'qwen-max'])];
  }

  async chat(messages: readonly Message[], options?: ChatOptions): Promise<ChatResponse> {
    let content = '';
    for await (const chunk of this.stream(messages, options)) {
      if (!chunk.done) content += chunk.delta;
    }
    return { content, model: options?.model ?? this.config.defaultModel ?? 'qwen-turbo' };
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env['QWEN_COOKIE'];
  }

  async *stream(messages: readonly Message[], options?: ChatOptions): AsyncIterable<StreamChunk> {
    const nativeMsgs = messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: typeof m.content === 'string' ? m.content : '' }));
    const model = options?.model ?? this.config.defaultModel ?? 'qwen-turbo';
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
      lastChecked: new Date(),
      models: this.getModels(),
      ...(configured ? {} : { error: 'QWEN_COOKIE not set' }),
    };
  }
}

export function createQwenProvider(config?: Partial<QwenConfig>): QwenProvider {
  return new QwenProvider(config);
}

export const qwenProvider = new QwenProvider();

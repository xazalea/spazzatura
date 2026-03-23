/**
 * GLM Provider — delegates to GLMNativeProvider (direct HTTP to chatglm.cn).
 * Auth: GLM_FREE_COOKIE env var (refresh token, set by `spaz auth chatglm`).
 */

import { GLMNativeProvider } from './native/index.js';
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

export interface GLMConfig extends ProviderConfig {
  type: 'glm';
}

export class GLMProvider implements Provider {
  readonly name = 'glm';
  readonly type = 'glm' as const;
  readonly capabilities: ProviderCapabilities;
  readonly config: ProviderConfig;

  private native = new GLMNativeProvider();

  constructor(config: Partial<GLMConfig> = {}) {
    this.config = {
      name: 'glm',
      type: 'glm',
      models: ['glm-4-flash', 'glm-4', 'glm-4-plus', 'glm-4-think'],
      defaultModel: 'glm-4-flash',
      timeout: 30000,
      maxRetries: 3,
      enabled: config.enabled ?? true,
      ...config,
    };
    this.capabilities = getDefaultCapabilities('glm');
  }

  getModels(): string[] {
    return [...(this.config.models ?? ['glm-4-flash', 'glm-4', 'glm-4-plus', 'glm-4-think'])];
  }

  async chat(messages: readonly Message[], options?: ChatOptions): Promise<ChatResponse> {
    let content = '';
    for await (const chunk of this.stream(messages, options)) {
      if (!chunk.done) content += chunk.delta;
    }
    return { content, model: options?.model ?? this.config.defaultModel ?? 'glm-4-flash' };
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env['GLM_FREE_COOKIE'];
  }

  async *stream(messages: readonly Message[], options?: ChatOptions): AsyncIterable<StreamChunk> {
    const nativeMsgs = messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: typeof m.content === 'string' ? m.content : '' }));
    const model = options?.model ?? this.config.defaultModel ?? 'glm-4-flash';
    for await (const delta of this.native.stream(nativeMsgs, { model })) {
      yield { delta, done: false };
    }
    yield { delta: '', done: true };
  }

  async getHealth(): Promise<ProviderStatus> {
    const configured = !!process.env['GLM_FREE_COOKIE'];
    return {
      name: this.name,
      available: configured,
      lastChecked: new Date(),
      models: this.getModels(),
      ...(configured ? {} : { error: 'GLM_FREE_COOKIE not set' }),
    };
  }
}

export function createGLMProvider(config?: Partial<GLMConfig>): GLMProvider {
  return new GLMProvider(config);
}

export const glmProvider = new GLMProvider();

/**
 * Ollama Provider
 *
 * Local LLM provider using Ollama (ollama.ai).
 * Run any open-source LLM locally — completely free, no API key needed.
 *
 * Models: llama3, mistral, codellama, deepseek-coder, qwen2.5-coder, etc.
 * Authentication: None (local server)
 * Install: https://ollama.ai
 */

import { OpenAICompatibleProvider } from '../base.js';
import type {
  Provider,
  ProviderConfig,
  ProviderCapabilities,
  ProviderStatus,
} from '../types.js';

export interface OllamaConfig extends ProviderConfig {
  type: 'ollama';
  baseUrl?: string;
}

export const OLLAMA_DEFAULT_MODELS = [
  'llama3.2',
  'llama3.1',
  'mistral',
  'codellama',
  'deepseek-coder-v2',
  'qwen2.5-coder',
  'phi3',
  'gemma2',
  'nomic-embed-text',
] as const;

export class OllamaProvider extends OpenAICompatibleProvider implements Provider {
  readonly name = 'ollama';
  readonly type = 'ollama' as const;

  readonly capabilities: ProviderCapabilities = {
    chat: true,
    streaming: true,
    vision: true,
    tts: false,
    stt: false,
    imageGeneration: false,
    embedding: true,
    functionCalling: true,
    maxContextLength: 128000,
  };

  readonly config: ProviderConfig;

  constructor(config: Partial<OllamaConfig> = {}) {
    const fullConfig: ProviderConfig = {
      name: 'ollama',
      type: 'ollama',
      baseUrl: config.baseUrl ?? process.env['OLLAMA_HOST'] ?? 'http://localhost:11434',
      models: config.models ?? [...OLLAMA_DEFAULT_MODELS],
      defaultModel: config.defaultModel ?? 'llama3.2',
      timeout: config.timeout ?? 120000, // Local models can be slow
      maxRetries: config.maxRetries ?? 2,
      enabled: config.enabled ?? true,
      ...config,
    };

    super(fullConfig);
    this.config = fullConfig;
  }

  protected getDefaultBaseUrl(): string {
    return process.env['OLLAMA_HOST'] ?? 'http://localhost:11434';
  }

  override async getHealth(): Promise<ProviderStatus> {
    try {
      const start = Date.now();
      const response = await fetch(`${this.getBaseUrl()}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      const latency = Date.now() - start;

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { models?: Array<{ name: string }> };
      const installedModels = (data.models ?? []).map(m => m.name);

      return {
        name: this.name,
        available: true,
        latency,
        lastChecked: new Date(),
        models: installedModels.length > 0 ? installedModels : this.getModels(),
      };
    } catch (error) {
      return {
        name: this.name,
        available: false,
        error: error instanceof Error
          ? `Ollama not running: ${error.message}. Install at https://ollama.ai`
          : 'Ollama not available',
        lastChecked: new Date(),
      };
    }
  }
}

export function createOllamaProvider(config: Partial<OllamaConfig> = {}): OllamaProvider {
  return new OllamaProvider(config);
}

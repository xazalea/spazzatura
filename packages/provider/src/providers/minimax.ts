/**
 * MiniMax Free API Provider
 * 
 * Provides access to MiniMax's Hailuo AI models through the minimax-free-api proxy.
 * Features: chat, streaming, vision, TTS, STT
 * 
 * Models: abab6.5s-chat, abab6.5g-chat, abab6.5t-chat, hailuo, MiniMax-Text-01
 * Authentication: API key or token (from environment)
 */

import { OpenAICompatibleProvider } from '../base.js';
import type {
  Provider,
  ProviderConfig,
  ProviderCapabilities,
  ProviderStatus,
} from '../types.js';
import { ProviderError } from '../types.js';
import { getDefaultCapabilities } from '../config.js';

/**
 * MiniMax provider configuration
 */
export interface MiniMaxConfig extends ProviderConfig {
  type: 'minimax';
  /** MiniMax API key */
  apiKey?: string;
  /** MiniMax token (from Hailuo AI web interface) */
  token?: string;
  /** Base URL for MiniMax API */
  baseUrl?: string;
}

/**
 * MiniMax TTS voice options
 */
export type MiniMaxVoice = 
  | 'male-botong'      // 思远 (alloy)
  | 'Podcast_girl'     // 心悦 (echo)
  | 'boyan_new_hailuo' // 子轩 (fable)
  | 'female-shaonv'    // 灵儿 (onyx)
  | 'YaeMiko_hailuo'   // 语嫣 (nova)
  | 'xiaoyi_mix_hailuo'; // 少泽 (shimmer)

/**
 * TTS options for MiniMax
 */
export interface TTSOptions {
  /** Text to synthesize */
  text: string;
  /** Voice to use */
  voice?: MiniMaxVoice;
  /** Output format */
  responseFormat?: 'mp3' | 'wav';
}

/**
 * STT options for MiniMax
 */
export interface STTOptions {
  /** Audio file path or buffer */
  audio: Buffer | string;
  /** Language hint */
  language?: string;
}

/**
 * MiniMax Free API Provider implementation
 */
export class MiniMaxProvider extends OpenAICompatibleProvider implements Provider {
  readonly name = 'minimax';
  readonly type = 'minimax' as const;
  
  readonly capabilities: ProviderCapabilities;
  readonly config: ProviderConfig;

  constructor(config: Partial<MiniMaxConfig> = {}) {
    const fullConfig: ProviderConfig = {
      name: 'minimax',
      type: 'minimax',
      baseUrl: config.baseUrl ?? 'http://localhost:8000',
      models: config.models ?? ['abab6.5s-chat', 'abab6.5g-chat', 'abab6.5t-chat', 'hailuo', 'MiniMax-Text-01'],
      defaultModel: config.defaultModel ?? 'hailuo',
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      enabled: config.enabled ?? true,
      ...config,
    };
    
    super(fullConfig);
    this.config = fullConfig;
    this.capabilities = getDefaultCapabilities('minimax');
  }

  /**
   * Get default base URL
   */
  protected getDefaultBaseUrl(): string {
    return 'http://localhost:8000';
  }

  /**
   * Build headers for MiniMax API requests
   */
  protected override buildHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };

    // MiniMax supports both API key and token authentication
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    } else if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    // Add custom headers from config
    if (this.config.headers) {
      Object.assign(headers, this.config.headers);
    }

    return headers;
  }

  /**
   * Text-to-speech synthesis
   */
  async speech(options: TTSOptions): Promise<Buffer> {
    return this.request(async () => {
      const response = await fetch(`${this.getBaseUrl()}/v1/audio/speech`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: 'hailuo',
          input: options.text,
          voice: options.voice ?? 'Podcast_girl',
          response_format: options.responseFormat ?? 'mp3',
        }),
        signal: this.createAbortSignal(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ProviderError(
          `TTS request failed: ${response.status} ${response.statusText} - ${errorText}`,
          this.name,
          response.status.toString(),
          response.status,
          response.status === 429 || response.status >= 500
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }, 'speech');
  }

  /**
   * Speech-to-text transcription
   */
  async transcribe(options: STTOptions): Promise<string> {
    return this.request(async () => {
      const formData = new FormData();
      
      if (typeof options.audio === 'string') {
        // Read file if path provided
        const fs = await import('fs/promises');
        const fileBuffer = await fs.readFile(options.audio);
        formData.append('file', new Blob([fileBuffer]), 'audio.mp3');
      } else {
        formData.append('file', new Blob([options.audio]), 'audio.mp3');
      }
      
      formData.append('model', 'hailuo');
      
      if (options.language) {
        formData.append('language', options.language);
      }

      const response = await fetch(`${this.getBaseUrl()}/v1/audio/transcriptions`, {
        method: 'POST',
        headers: {
          ...this.buildHeaders(),
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
        signal: this.createAbortSignal(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ProviderError(
          `STT request failed: ${response.status} ${response.statusText} - ${errorText}`,
          this.name,
          response.status.toString(),
          response.status,
          response.status === 429 || response.status >= 500
        );
      }

      const data = await response.json() as { text: string };
      return data.text;
    }, 'transcribe');
  }

  /**
   * Get provider health status
   */
  override async getHealth(): Promise<ProviderStatus> {
    try {
      const { latency } = await this.measureLatency(async () => {
        // Try a minimal request to check health
        const response = await fetch(`${this.getBaseUrl()}/v1/models`, {
          method: 'GET',
          headers: this.buildHeaders(),
          signal: this.createAbortSignal(5000),
        });

        if (!response.ok && response.status !== 404) {
          throw new Error(`Health check failed: ${response.status}`);
        }

        return response;
      });

      return {
        name: this.name,
        available: true,
        latency,
        lastChecked: new Date(),
        models: this.getModels(),
      };
    } catch (error) {
      return {
        name: this.name,
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date(),
        models: this.getModels(),
      };
    }
  }
}

/**
 * Create a MiniMax provider instance
 */
export function createMiniMaxProvider(config?: Partial<MiniMaxConfig>): MiniMaxProvider {
  return new MiniMaxProvider(config);
}

/**
 * Default MiniMax provider instance
 */
export const minimaxProvider = new MiniMaxProvider();

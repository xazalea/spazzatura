/**
 * OpenAI Provider
 * 
 * Standard OpenAI API provider for users with official API keys.
 * Features: chat, streaming, vision, TTS, STT, image generation, embeddings
 * 
 * Models: gpt-4o, gpt-4-turbo, gpt-3.5-turbo
 * Authentication: API key (required)
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
 * OpenAI provider configuration
 */
export interface OpenAIConfig extends ProviderConfig {
  type: 'openai';
  /** OpenAI API key (required) */
  apiKey: string;
  /** Organization ID */
  organization?: string;
  /** Base URL for OpenAI API */
  baseUrl?: string;
}

/**
 * OpenAI TTS voice options
 */
export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

/**
 * TTS options for OpenAI
 */
export interface OpenAITTSOptions {
  /** Text to synthesize */
  text: string;
  /** Voice to use */
  voice?: OpenAIVoice;
  /** Output format */
  responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  /** Speed (0.25 to 4.0) */
  speed?: number;
}

/**
 * STT options for OpenAI
 */
export interface OpenAISTTOptions {
  /** Audio file path or buffer */
  audio: Buffer | string;
  /** Language hint */
  language?: string;
  /** Model to use */
  model?: 'whisper-1';
}

/**
 * Image generation options for OpenAI
 */
export interface OpenAIImageOptions {
  /** Prompt for image generation */
  prompt: string;
  /** Model to use */
  model?: 'dall-e-2' | 'dall-e-3';
  /** Number of images to generate */
  n?: number;
  /** Image size */
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
  /** Quality */
  quality?: 'standard' | 'hd';
  /** Style */
  style?: 'vivid' | 'natural';
  /** Response format */
  responseFormat?: 'url' | 'b64_json';
}

/**
 * OpenAI Provider implementation
 */
export class OpenAIProvider extends OpenAICompatibleProvider implements Provider {
  readonly name = 'openai';
  readonly type = 'openai' as const;
  
  readonly capabilities: ProviderCapabilities;
  readonly config: ProviderConfig;

  constructor(config: Partial<OpenAIConfig> & { apiKey: string }) {
    const fullConfig: ProviderConfig = {
      name: 'openai',
      type: 'openai',
      baseUrl: config.baseUrl ?? 'https://api.openai.com',
      models: config.models ?? ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      defaultModel: config.defaultModel ?? 'gpt-4o',
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      enabled: config.enabled ?? true,
      ...config,
    };
    
    super(fullConfig);
    this.config = fullConfig;
    this.capabilities = getDefaultCapabilities('openai');
  }

  /**
   * Get default base URL
   */
  protected getDefaultBaseUrl(): string {
    return 'https://api.openai.com';
  }

  /**
   * Build headers for OpenAI API requests
   */
  protected override buildHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...additionalHeaders,
    };

    // Add organization header if provided
    const org = (this.config as OpenAIConfig).organization;
    if (org) {
      headers['OpenAI-Organization'] = org;
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
  async speech(options: OpenAITTSOptions): Promise<Buffer> {
    return this.request(async () => {
      const response = await fetch(`${this.getBaseUrl()}/v1/audio/speech`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: 'tts-1',
          input: options.text,
          voice: options.voice ?? 'alloy',
          response_format: options.responseFormat ?? 'mp3',
          speed: options.speed ?? 1.0,
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
  async transcribe(options: OpenAISTTOptions): Promise<string> {
    return this.request(async () => {
      const formData = new FormData();
      
      if (typeof options.audio === 'string') {
        const fs = await import('fs/promises');
        const fileBuffer = await fs.readFile(options.audio);
        formData.append('file', new Blob([fileBuffer]), 'audio.mp3');
      } else {
        formData.append('file', new Blob([options.audio]), 'audio.mp3');
      }
      
      formData.append('model', options.model ?? 'whisper-1');
      
      if (options.language) {
        formData.append('language', options.language);
      }

      const response = await fetch(`${this.getBaseUrl()}/v1/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
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
   * Generate images using DALL-E
   */
  async generateImage(options: OpenAIImageOptions): Promise<{
    created: number;
    data: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
  }> {
    return this.request(async () => {
      const response = await fetch(`${this.getBaseUrl()}/v1/images/generations`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: options.model ?? 'dall-e-3',
          prompt: options.prompt,
          n: options.n ?? 1,
          size: options.size ?? '1024x1024',
          quality: options.quality ?? 'standard',
          style: options.style ?? 'vivid',
          response_format: options.responseFormat ?? 'url',
        }),
        signal: this.createAbortSignal(120000), // 2 minute timeout for image generation
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ProviderError(
          `Image generation failed: ${response.status} ${response.statusText} - ${errorText}`,
          this.name,
          response.status.toString(),
          response.status,
          response.status === 429 || response.status >= 500
        );
      }

      return await response.json() as { created: number; data: Array<{ url?: string; b64_json?: string; revised_prompt?: string }> };
    }, 'generateImage');
  }

  /**
   * Generate text embeddings
   */
  async embed(text: string, model?: string): Promise<number[]> {
    return this.request(async () => {
      const response = await fetch(`${this.getBaseUrl()}/v1/embeddings`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: model ?? 'text-embedding-3-small',
          input: text,
        }),
        signal: this.createAbortSignal(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ProviderError(
          `Embedding request failed: ${response.status} ${response.statusText} - ${errorText}`,
          this.name,
          response.status.toString(),
          response.status,
          response.status === 429 || response.status >= 500
        );
      }

      const data = await response.json() as {
        data: Array<{ embedding: number[] }>;
      };
      return data.data[0]?.embedding ?? [];
    }, 'embed');
  }

  /**
   * Get provider health status
   */
  override async getHealth(): Promise<ProviderStatus> {
    try {
      const { latency } = await this.measureLatency(async () => {
        const response = await fetch(`${this.getBaseUrl()}/v1/models`, {
          method: 'GET',
          headers: this.buildHeaders(),
          signal: this.createAbortSignal(5000),
        });

        if (!response.ok) {
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
 * Create an OpenAI provider instance
 */
export function createOpenAIProvider(config: Partial<OpenAIConfig> & { apiKey: string }): OpenAIProvider {
  return new OpenAIProvider(config);
}

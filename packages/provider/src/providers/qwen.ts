/**
 * Qwen Free API Provider
 * 
 * Provides access to Alibaba's Qwen (通义千问) models through the qwen-free-api proxy.
 * Features: chat, streaming, vision, image generation
 * 
 * Models: qwen-turbo, qwen-plus, qwen-max
 * Authentication: API key or cookie (from environment)
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
 * Qwen provider configuration
 */
export interface QwenConfig extends ProviderConfig {
  type: 'qwen';
  /** Qwen API key */
  apiKey?: string;
  /** Tongyi SSO ticket (from cookies) */
  cookie?: string;
  /** Base URL for Qwen API */
  baseUrl?: string;
}

/**
 * Image generation options for Qwen
 */
export interface ImageGenerationOptions {
  /** Prompt for image generation */
  prompt: string;
  /** Number of images to generate */
  n?: number;
  /** Image size */
  size?: '256x256' | '512x512' | '1024x1024';
  /** Response format */
  responseFormat?: 'url' | 'b64_json';
}

/**
 * Image generation response
 */
export interface ImageGenerationResponse {
  /** Creation timestamp */
  created: number;
  /** Generated images */
  data: Array<{
    url?: string;
    b64_json?: string;
  }>;
}

/**
 * Qwen Free API Provider implementation
 */
export class QwenProvider extends OpenAICompatibleProvider implements Provider {
  readonly name = 'qwen';
  readonly type = 'qwen' as const;
  
  readonly capabilities: ProviderCapabilities;
  readonly config: ProviderConfig;

  constructor(config: Partial<QwenConfig> = {}) {
    const fullConfig: ProviderConfig = {
      name: 'qwen',
      type: 'qwen',
      baseUrl: config.baseUrl ?? 'http://localhost:8001',
      models: config.models ?? ['qwen-turbo', 'qwen-plus', 'qwen-max'],
      defaultModel: config.defaultModel ?? 'qwen-plus',
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      enabled: config.enabled ?? true,
      ...config,
    };
    
    super(fullConfig);
    this.config = fullConfig;
    this.capabilities = getDefaultCapabilities('qwen');
  }

  /**
   * Get default base URL
   */
  protected getDefaultBaseUrl(): string {
    return 'http://localhost:8001';
  }

  /**
   * Build headers for Qwen API requests
   */
  protected override buildHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };

    // Qwen supports API key or cookie authentication
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    } else if (this.config.cookie) {
      headers['Cookie'] = this.config.cookie;
    }

    // Add custom headers from config
    if (this.config.headers) {
      Object.assign(headers, this.config.headers);
    }

    return headers;
  }

  /**
   * Generate images using Qwen's Wanxiang model
   */
  async generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResponse> {
    return this.request(async () => {
      const response = await fetch(`${this.getBaseUrl()}/v1/images/generations`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: 'wanxiang',
          prompt: options.prompt,
          n: options.n ?? 1,
          size: options.size ?? '1024x1024',
          response_format: options.responseFormat ?? 'url',
        }),
        signal: this.createAbortSignal(),
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

      return await response.json() as ImageGenerationResponse;
    }, 'generateImage');
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
 * Create a Qwen provider instance
 */
export function createQwenProvider(config?: Partial<QwenConfig>): QwenProvider {
  return new QwenProvider(config);
}

/**
 * Default Qwen provider instance
 */
export const qwenProvider = new QwenProvider();

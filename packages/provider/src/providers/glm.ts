/**
 * GLM Free API Provider (xiaoY233 fork - safe version)
 * 
 * Provides access to Zhipu AI's GLM models through the GLM-Free-API proxy.
 * Features: chat, streaming, vision, image generation
 * 
 * Models: glm-4, glm-4-plus, glm-4-air, glm-4-zero
 * Authentication: Cookie (from environment)
 * 
 * Note: This uses the xiaoY233 fork which has removed malicious code from the original.
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
 * GLM provider configuration
 */
export interface GLMConfig extends ProviderConfig {
  type: 'glm';
  /** GLM API key */
  apiKey?: string;
  /** Refresh token from 智谱清言 (chatglm.cn) */
  cookie?: string;
  /** Base URL for GLM API */
  baseUrl?: string;
}

/**
 * Image generation options for GLM
 */
export interface GLMImageOptions {
  /** Prompt for image generation */
  prompt: string;
  /** Number of images to generate */
  n?: number;
  /** Image size */
  size?: '256x256' | '512x512' | '1024x1024';
}

/**
 * Video generation options for GLM
 */
export interface GLMVideoOptions {
  /** Prompt for video generation */
  prompt: string;
  /** Video duration in seconds */
  duration?: number;
}

/**
 * GLM Free API Provider implementation
 */
export class GLMProvider extends OpenAICompatibleProvider implements Provider {
  readonly name = 'glm';
  readonly type = 'glm' as const;
  
  readonly capabilities: ProviderCapabilities;
  readonly config: ProviderConfig;

  constructor(config: Partial<GLMConfig> = {}) {
    const fullConfig: ProviderConfig = {
      name: 'glm',
      type: 'glm',
      baseUrl: config.baseUrl ?? 'http://localhost:8002',
      models: config.models ?? ['glm-4', 'glm-4-plus', 'glm-4-air', 'glm-4-zero'],
      defaultModel: config.defaultModel ?? 'glm-4-plus',
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      enabled: config.enabled ?? true,
      ...config,
    };
    
    super(fullConfig);
    this.config = fullConfig;
    this.capabilities = getDefaultCapabilities('glm');
  }

  /**
   * Get default base URL
   */
  protected getDefaultBaseUrl(): string {
    return 'http://localhost:8002';
  }

  /**
   * Build headers for GLM API requests
   */
  protected override buildHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };

    // GLM supports API key or cookie authentication
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    } else if (this.config.cookie) {
      headers['Authorization'] = `Bearer ${this.config.cookie}`;
    }

    // Add custom headers from config
    if (this.config.headers) {
      Object.assign(headers, this.config.headers);
    }

    return headers;
  }

  /**
   * Generate images using GLM
   */
  async generateImage(options: GLMImageOptions): Promise<{
    created: number;
    data: Array<{ url?: string; b64_json?: string }>;
  }> {
    return this.request(async () => {
      const response = await fetch(`${this.getBaseUrl()}/v1/images/generations`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: 'glm-4',
          prompt: options.prompt,
          n: options.n ?? 1,
          size: options.size ?? '1024x1024',
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

      return await response.json() as { created: number; data: Array<{ url?: string; b64_json?: string }> };
    }, 'generateImage');
  }

  /**
   * Generate video using GLM (if supported)
   */
  async generateVideo(options: GLMVideoOptions): Promise<{
    created: number;
    data: Array<{ url: string }>;
  }> {
    return this.request(async () => {
      const response = await fetch(`${this.getBaseUrl()}/v1/videos/generations`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: 'glm-4',
          prompt: options.prompt,
          duration: options.duration ?? 5,
        }),
        signal: this.createAbortSignal(120000), // 2 minute timeout for video
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ProviderError(
          `Video generation failed: ${response.status} ${response.statusText} - ${errorText}`,
          this.name,
          response.status.toString(),
          response.status,
          response.status === 429 || response.status >= 500
        );
      }

      return await response.json() as { created: number; data: Array<{ url: string }> };
    }, 'generateVideo');
  }

  /**
   * Check token validity
   */
  async checkToken(): Promise<{ valid: boolean; remaining?: number }> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/token/check`, {
        method: 'POST',
        headers: this.buildHeaders(),
        signal: this.createAbortSignal(10000),
      });

      if (!response.ok) {
        return { valid: false };
      }

      const data = await response.json() as { valid?: boolean; remaining?: number };
      const result: { valid: boolean; remaining?: number } = {
        valid: data.valid ?? true,
      };
      if (data.remaining !== undefined) {
        result.remaining = data.remaining;
      }
      return result;
    } catch {
      return { valid: false };
    }
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
 * Create a GLM provider instance
 */
export function createGLMProvider(config?: Partial<GLMConfig>): GLMProvider {
  return new GLMProvider(config);
}

/**
 * Default GLM provider instance
 */
export const glmProvider = new GLMProvider();

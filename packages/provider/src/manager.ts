/**
 * Provider Manager
 * Manages provider lifecycle, configuration, and routing
 */

import type { Provider, ProviderConfig, RoutingConfig, ProviderManagerConfig, Message, ChatOptions, ChatResponse, StreamChunk, ProviderStatus } from './types.js';
import { ProviderRouter } from './router.js';
import { loadConfig, validateConfig, getConfigFromEnv } from './config.js';
import { createProvider } from './providers/index.js';

/**
 * Provider Manager
 * Central manager for all provider operations
 */
export class ProviderManager {
  private readonly router: ProviderRouter;
  private readonly config: ProviderManagerConfig;
  private readonly providers: Map<string, Provider> = new Map();

  constructor(config: ProviderManagerConfig = {}) {
    this.config = config;
    
    // Initialize providers from config
    const providerConfigs = config.providers 
      ? Object.values(config.providers)
      : [];
    
    // Create router with routing config
    this.router = new ProviderRouter(providerConfigs, config.routing ?? {
      strategy: 'failover',
      autoFailover: true,
    });

    // Store provider instances
    for (const [name, providerConfig] of Object.entries(config.providers ?? {})) {
      const provider = createProvider(name as never, providerConfig);
      this.providers.set(name, provider);
    }
  }

  /**
   * Create manager from configuration file
   */
  static async fromFile(configPath: string): Promise<ProviderManager> {
    const config = await loadConfig(configPath);
    return new ProviderManager(config);
  }

  /**
   * Create manager from environment variables
   */
  static fromEnv(): ProviderManager {
    const config = getConfigFromEnv();
    return new ProviderManager(config);
  }

  /**
   * Get provider by name
   */
  getProvider(name: string): Provider | undefined {
    return this.providers.get(name) ?? this.router.getProvider(name);
  }

  /**
   * Get all providers
   */
  getAllProviders(): Provider[] {
    return this.router.getAllProviders();
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): Provider[] {
    return this.router.getAvailableProviders();
  }

  /**
   * Get default provider
   */
  getDefaultProvider(): Provider | undefined {
    if (this.config.defaultProvider) {
      return this.getProvider(this.config.defaultProvider);
    }
    return this.getAvailableProviders()[0];
  }

  /**
   * Add a new provider
   */
  addProvider(name: string, config: ProviderConfig): void {
    const provider = createProvider(name as never, config);
    this.providers.set(name, provider);
    this.router.addProvider(config);
  }

  /**
   * Remove a provider
   */
  removeProvider(name: string): boolean {
    this.providers.delete(name);
    return this.router.removeProvider(name);
  }

  /**
   * Enable a provider
   */
  enableProvider(name: string): void {
    this.router.enableProvider(name);
  }

  /**
   * Disable a provider
   */
  disableProvider(name: string): void {
    this.router.disableProvider(name);
  }

  /**
   * Send a chat request
   */
  async chat(
    messages: readonly Message[],
    options?: ChatOptions & { provider?: string }
  ): Promise<ChatResponse> {
    const preferredProvider = options?.provider ?? this.config.defaultProvider;
    if (preferredProvider) {
      return this.router.chat(messages, {
        ...options,
        preferredProvider,
      });
    }
    return this.router.chat(messages, options);
  }

  /**
   * Send a streaming chat request
   */
  async *stream(
    messages: readonly Message[],
    options?: ChatOptions & { provider?: string }
  ): AsyncIterable<StreamChunk> {
    const preferredProvider = options?.provider ?? this.config.defaultProvider;
    if (preferredProvider) {
      yield* this.router.stream(messages, {
        ...options,
        preferredProvider,
      });
    } else {
      yield* this.router.stream(messages, options);
    }
  }

  /**
   * Generate speech from text
   */
  async speech(
    text: string,
    options?: Record<string, unknown> & { provider?: string }
  ): Promise<ArrayBuffer> {
    return this.router.speech(text, options);
  }

  /**
   * Transcribe audio to text
   */
  async transcribe(
    audio: ArrayBuffer,
    options?: Record<string, unknown> & { provider?: string }
  ): Promise<string> {
    return this.router.transcribe(audio, options);
  }

  /**
   * Generate an image
   */
  async generateImage(
    prompt: string,
    options?: Record<string, unknown> & { provider?: string }
  ): Promise<unknown> {
    return this.router.generateImage(prompt, options);
  }

  /**
   * Generate embeddings
   */
  async embed(
    text: string,
    options?: { provider?: string }
  ): Promise<readonly number[]> {
    const preferredProvider = options?.provider;
    if (preferredProvider) {
      return this.router.embed(text, { preferredProvider });
    }
    return this.router.embed(text);
  }

  /**
   * Check health of all providers
   */
  async checkHealth(): Promise<void> {
    await this.router.checkAllHealth();
  }

  /**
   * Get provider status
   */
  getProviderStatus(name: string): ProviderStatus | undefined {
    const status = this.router.getStatus();
    const found = status.providers.find(p => p.name === name);
    if (!found) return undefined;
    return {
      name: found.name,
      available: found.available,
      latency: found.latency ?? 0,
      lastChecked: new Date(),
    };
  }

  /**
   * Get all provider statuses
   */
  getAllProviderStatuses(): ProviderStatus[] {
    const status = this.router.getStatus();
    return status.providers.map(p => ({
      name: p.name,
      available: p.available,
      latency: p.latency ?? 0,
      lastChecked: new Date(),
    }));
  }

  /**
   * Get router status
   */
  getRouterStatus(): {
    providers: Array<{
      name: string;
      available: boolean;
      latency: number | undefined;
      consecutiveFailures: number;
    }>;
    routingConfig: RoutingConfig;
  } {
    return this.router.getStatus();
  }

  /**
   * Start health checks
   */
  startHealthChecks(intervalMs?: number): void {
    this.router.startHealthChecks(intervalMs);
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    this.router.stopHealthChecks();
  }

  /**
   * Get configuration
   */
  getConfig(): ProviderManagerConfig {
    return this.config;
  }

  /**
   * Validate current configuration
   */
  validate(): string[] {
    return validateConfig(this.config);
  }
}

/**
 * Create a provider manager
 */
export function createProviderManager(config?: ProviderManagerConfig): ProviderManager {
  return new ProviderManager(config);
}

/**
 * Create a provider manager from a config file
 */
export async function createProviderManagerFromFile(path: string): Promise<ProviderManager> {
  return ProviderManager.fromFile(path);
}

/**
 * Create a provider manager from environment variables
 */
export function createProviderManagerFromEnv(): ProviderManager {
  return ProviderManager.fromEnv();
}

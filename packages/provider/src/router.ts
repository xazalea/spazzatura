/**
 * Provider Router
 * Handles request routing with automatic failover and feature-based routing
 */

import type { Provider, ProviderConfig, RoutingConfig, Message, ChatOptions, ChatResponse, StreamChunk, ProviderCapabilities, ProviderStatus } from './types.js';
import { RoutingError } from './types.js';
import { createProvider } from './providers/index.js';

/**
 * Internal router state for tracking provider health
 */
interface ProviderState {
  provider: Provider;
  config: ProviderConfig;
  status: ProviderStatus;
  consecutiveFailures: number;
  lastFailure?: Date;
  lastSuccess?: Date;
}

/**
 * Routing decision result
 */
interface RoutingDecision {
  provider: Provider;
  fallbackChain: Provider[];
}

/**
 * Provider Router
 * Routes requests to appropriate providers with automatic failover
 */
export class ProviderRouter {
  private readonly providers: Map<string, ProviderState> = new Map();
  private readonly routingConfig: RoutingConfig;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    providerConfigs: ProviderConfig[],
    routingConfig: RoutingConfig
  ) {
    this.routingConfig = routingConfig;
    
    // Initialize providers
    for (const config of providerConfigs) {
      if (config.enabled !== false) {
        const provider = createProvider(config.name as never, config);
        this.providers.set(config.name, {
          provider,
          config,
          status: {
            name: config.name,
            available: true,
            latency: 0,
            lastChecked: new Date(),
          },
          consecutiveFailures: 0,
        });
      }
    }
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(intervalMs: number = 60000): void {
    this.stopHealthChecks();
    this.healthCheckInterval = setInterval(() => {
      this.checkAllHealth().catch(err => {
        console.error('Health check failed:', err);
      });
    }, intervalMs);
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Check health of all providers
   */
  async checkAllHealth(): Promise<void> {
    const checks = Array.from(this.providers.entries()).map(async ([name, state]) => {
      try {
        const status = await state.provider.getHealth();
        state.status = status;
        if (status.available) {
          state.consecutiveFailures = 0;
          state.lastSuccess = new Date();
        }
      } catch (error) {
        state.status = {
          name,
          available: false,
          latency: 0,
          lastChecked: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        state.consecutiveFailures++;
        state.lastFailure = new Date();
      }
    });

    await Promise.allSettled(checks);
  }

  /**
   * Get provider by name
   */
  getProvider(name: string): Provider | undefined {
    return this.providers.get(name)?.provider;
  }

  /**
   * Get all providers
   */
  getAllProviders(): Provider[] {
    return Array.from(this.providers.values()).map(state => state.provider);
  }

  /**
   * Get available providers sorted by failover order
   */
  getAvailableProviders(): Provider[] {
    const failoverOrder = this.routingConfig.failoverOrder;
    
    const available = Array.from(this.providers.values())
      .filter(state => state.status.available && state.config.enabled !== false);

    if (failoverOrder && failoverOrder.length > 0) {
      // Sort by failover order
      const orderMap = new Map(failoverOrder.map((name, index) => [name, index]));
      available.sort((a, b) => {
        const orderA = orderMap.get(a.config.name) ?? Infinity;
        const orderB = orderMap.get(b.config.name) ?? Infinity;
        return orderA - orderB;
      });
    }

    return available.map(state => state.provider);
  }

  /**
   * Find providers with specific capability
   */
  getProvidersWithCapability(capability: keyof ProviderCapabilities): Provider[] {
    return this.getAvailableProviders().filter(provider => {
      const caps = provider.capabilities;
      return caps[capability] === true;
    });
  }

  /**
   * Make routing decision based on requirements
   */
  private makeRoutingDecision(
    requiredCapability?: keyof ProviderCapabilities,
    preferredProvider?: string
  ): RoutingDecision {
    // If preferred provider is specified and available, use it
    if (preferredProvider) {
      const state = this.providers.get(preferredProvider);
      if (state?.status.available && state.config.enabled !== false) {
        const provider = state.provider;
        
        // Check capability if required
        if (requiredCapability) {
          const caps = provider.capabilities;
          if (!caps[requiredCapability]) {
            throw new RoutingError(
              `Provider "${preferredProvider}" does not support ${requiredCapability}`,
              [preferredProvider]
            );
          }
        }

        // Build fallback chain
        const fallbackChain = this.buildFallbackChain(preferredProvider, requiredCapability);
        return { provider, fallbackChain };
      }
    }

    // Get providers with required capability
    let candidates = requiredCapability
      ? this.getProvidersWithCapability(requiredCapability)
      : this.getAvailableProviders();

    if (candidates.length === 0) {
      throw new RoutingError(
        requiredCapability
          ? `No available providers support ${requiredCapability}`
          : 'No available providers',
        []
      );
    }

    // Use routing strategy
    const primary = this.selectByStrategy(candidates);
    const fallbackChain = candidates.filter(p => p !== primary);

    return { provider: primary, fallbackChain };
  }

  /**
   * Select provider based on routing strategy
   */
  private selectByStrategy(candidates: Provider[]): Provider {
    const strategy = this.routingConfig.strategy;

    switch (strategy) {
      case 'failover':
        // Use first available (already sorted by failover order)
        return candidates[0]!;

      case 'round-robin': {
        // Rotate through providers
        const index = Date.now() % candidates.length;
        return candidates[index]!;
      }

      case 'feature-based':
        // Feature-based routing is handled at a higher level
        return candidates[0]!;

      case 'least-latency': {
        // Sort by latency
        const sorted = [...candidates].sort((a, b) => {
          const stateA = this.findProviderState(a);
          const stateB = this.findProviderState(b);
          return (stateA?.status.latency ?? Infinity) - (stateB?.status.latency ?? Infinity);
        });
        return sorted[0]!;
      }

      default:
        return candidates[0]!;
    }
  }

  /**
   * Find provider state by provider instance
   */
  private findProviderState(provider: Provider): ProviderState | undefined {
    for (const state of this.providers.values()) {
      if (state.provider === provider) {
        return state;
      }
    }
    return undefined;
  }

  /**
   * Build fallback chain excluding primary provider
   */
  private buildFallbackChain(
    excludeProvider: string,
    requiredCapability?: keyof ProviderCapabilities
  ): Provider[] {
    let candidates = this.getAvailableProviders().filter(p => {
      const state = this.findProviderState(p);
      return state?.config.name !== excludeProvider;
    });

    if (requiredCapability) {
      candidates = candidates.filter(p => p.capabilities[requiredCapability]);
    }

    return candidates;
  }

  /**
   * Execute request with automatic failover
   */
  private async executeWithFailover<T>(
    fn: (provider: Provider) => Promise<T>,
    requiredCapability?: keyof ProviderCapabilities,
    preferredProvider?: string
  ): Promise<T> {
    const { provider, fallbackChain } = this.makeRoutingDecision(
      requiredCapability,
      preferredProvider
    );

    const attempts: Array<{ provider: string; error: Error }> = [];

    // Try primary provider
    try {
      const result = await fn(provider);
      this.markSuccess(provider);
      return result;
    } catch (error) {
      const state = this.findProviderState(provider);
      const name = state?.config.name ?? 'unknown';
      attempts.push({
        provider: name,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      this.markFailure(provider);
    }

    // Try fallback providers
    for (const fallback of fallbackChain) {
      try {
        const result = await fn(fallback);
        this.markSuccess(fallback);
        return result;
      } catch (error) {
        const state = this.findProviderState(fallback);
        const name = state?.config.name ?? 'unknown';
        attempts.push({
          provider: name,
          error: error instanceof Error ? error : new Error(String(error)),
        });
        this.markFailure(fallback);
      }
    }

    // All providers failed
    const errorMessages = attempts
      .map(a => `${a.provider}: ${a.error.message}`)
      .join('; ');

    throw new RoutingError(
      `All providers failed: ${errorMessages}`,
      attempts.map(a => a.provider)
    );
  }

  /**
   * Mark provider as successful
   */
  private markSuccess(provider: Provider): void {
    const state = this.findProviderState(provider);
    if (state) {
      state.consecutiveFailures = 0;
      state.lastSuccess = new Date();
      // Update status to available
      state.status = {
        ...state.status,
        available: true,
      };
    }
  }

  /**
   * Mark provider as failed
   */
  private markFailure(provider: Provider): void {
    const state = this.findProviderState(provider);
    if (state) {
      state.consecutiveFailures++;
      state.lastFailure = new Date();
      
      // Mark as unavailable after threshold (default 3)
      const threshold = 3;
      if (state.consecutiveFailures >= threshold) {
        state.status = {
          ...state.status,
          available: false,
        };
      }
    }
  }

  /**
   * Route chat request
   */
  async chat(
    messages: readonly Message[],
    options?: ChatOptions & { preferredProvider?: string }
  ): Promise<ChatResponse> {
    return this.executeWithFailover(
      provider => provider.chat(messages, options),
      undefined,
      options?.preferredProvider
    );
  }

  /**
   * Route streaming chat request
   */
  async *stream(
    messages: readonly Message[],
    options?: ChatOptions & { preferredProvider?: string }
  ): AsyncIterable<StreamChunk> {
    const { provider, fallbackChain } = this.makeRoutingDecision(
      undefined,
      options?.preferredProvider
    );

    let currentProvider = provider;
    const remainingFallbacks = [...fallbackChain];
    const attempts: Array<{ provider: string; error: Error }> = [];

    // Try to stream from providers
    while (currentProvider) {
      const streamFn = currentProvider.stream;
      if (!streamFn) {
        const state = this.findProviderState(currentProvider);
        const name = state?.config.name ?? 'unknown';
        attempts.push({
          provider: name,
          error: new Error('Provider does not support streaming'),
        });
        
        const nextProvider = remainingFallbacks.shift();
        if (nextProvider) {
          currentProvider = nextProvider;
          continue;
        } else {
          break;
        }
      }

      try {
        for await (const chunk of streamFn.call(currentProvider, messages, options)) {
          yield chunk;
        }
        this.markSuccess(currentProvider);
        return;
      } catch (error) {
        const state = this.findProviderState(currentProvider);
        const name = state?.config.name ?? 'unknown';
        attempts.push({
          provider: name,
          error: error instanceof Error ? error : new Error(String(error)),
        });
        this.markFailure(currentProvider);

        // Try next fallback
        const nextProvider = remainingFallbacks.shift();
        if (nextProvider) {
          currentProvider = nextProvider;
        } else {
          break;
        }
      }
    }

    // All providers failed
    const errorMessages = attempts
      .map(a => `${a.provider}: ${a.error.message}`)
      .join('; ');

    throw new RoutingError(
      `All providers failed during streaming: ${errorMessages}`,
      attempts.map(a => a.provider)
    );
  }

  /**
   * Route text-to-speech request
   */
  async speech(
    text: string,
    options?: Record<string, unknown> & { preferredProvider?: string }
  ): Promise<ArrayBuffer> {
    // Find provider with TTS capability
    const featureBased = this.routingConfig.featureBased;
    const preferredTTS = options?.preferredProvider as string | undefined ?? featureBased?.tts;
    
    return this.executeWithFailover(
      provider => {
        // Check if provider has TTS capability via extended interface
        const extendedProvider = provider as Provider & { speech?(text: string, options?: Record<string, unknown>): Promise<ArrayBuffer> };
        if (extendedProvider.speech) {
          return extendedProvider.speech(text, options);
        }
        throw new Error('Provider does not support TTS');
      },
      'tts',
      preferredTTS
    );
  }

  /**
   * Route speech-to-text request
   */
  async transcribe(
    audio: ArrayBuffer,
    options?: Record<string, unknown> & { preferredProvider?: string }
  ): Promise<string> {
    const featureBased = this.routingConfig.featureBased;
    const preferredSTT = options?.preferredProvider as string | undefined ?? featureBased?.stt;
    
    return this.executeWithFailover(
      provider => {
        const extendedProvider = provider as Provider & { transcribe?(audio: ArrayBuffer, options?: Record<string, unknown>): Promise<string> };
        if (extendedProvider.transcribe) {
          return extendedProvider.transcribe(audio, options);
        }
        throw new Error('Provider does not support STT');
      },
      'stt',
      preferredSTT
    );
  }

  /**
   * Route image generation request
   */
  async generateImage(
    prompt: string,
    options?: Record<string, unknown> & { preferredProvider?: string }
  ): Promise<unknown> {
    const featureBased = this.routingConfig.featureBased;
    const preferredImage = options?.preferredProvider as string | undefined ?? featureBased?.imageGeneration;
    
    return this.executeWithFailover(
      provider => {
        const extendedProvider = provider as Provider & { generateImage?(prompt: string, options?: Record<string, unknown>): Promise<unknown> };
        if (extendedProvider.generateImage) {
          return extendedProvider.generateImage(prompt, options);
        }
        throw new Error('Provider does not support image generation');
      },
      'imageGeneration',
      preferredImage
    );
  }

  /**
   * Route embedding request
   */
  async embed(
    text: string,
    options?: { preferredProvider?: string }
  ): Promise<readonly number[]> {
    const featureBased = this.routingConfig.featureBased;
    const preferredEmbed = options?.preferredProvider ?? featureBased?.embedding;
    
    return this.executeWithFailover(
      provider => {
        if (provider.embed) {
          return provider.embed(text);
        }
        throw new Error('Provider does not support embeddings');
      },
      'embedding',
      preferredEmbed
    );
  }

  /**
   * Get router status
   */
  getStatus(): {
    providers: Array<{
      name: string;
      available: boolean;
      latency: number | undefined;
      consecutiveFailures: number;
    }>;
    routingConfig: RoutingConfig;
  } {
    const providers = Array.from(this.providers.entries()).map(([name, state]) => ({
      name,
      available: state.status.available,
      latency: state.status.latency,
      consecutiveFailures: state.consecutiveFailures,
    }));

    return {
      providers,
      routingConfig: this.routingConfig,
    };
  }

  /**
   * Add a new provider
   */
  addProvider(config: ProviderConfig): void {
    const provider = createProvider(config.name as never, config);
    this.providers.set(config.name, {
      provider,
      config,
      status: {
        name: config.name,
        available: true,
        latency: 0,
        lastChecked: new Date(),
      },
      consecutiveFailures: 0,
    });
  }

  /**
   * Remove a provider
   */
  removeProvider(name: string): boolean {
    return this.providers.delete(name);
  }

  /**
   * Enable a provider
   */
  enableProvider(name: string): void {
    const state = this.providers.get(name);
    if (state) {
      // Create new config with enabled=true
      state.config = { ...state.config, enabled: true };
    }
  }

  /**
   * Disable a provider
   */
  disableProvider(name: string): void {
    const state = this.providers.get(name);
    if (state) {
      // Create new config with enabled=false
      state.config = { ...state.config, enabled: false };
    }
  }
}

/**
 * Create a provider router
 */
export function createRouter(
  providerConfigs: ProviderConfig[],
  routingConfig?: Partial<RoutingConfig>
): ProviderRouter {
  const defaultRoutingConfig: RoutingConfig = {
    strategy: 'failover',
    autoFailover: true,
    ...routingConfig,
  };

  return new ProviderRouter(providerConfigs, defaultRoutingConfig);
}

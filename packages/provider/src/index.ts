/**
 * @spazzatura/provider
 * LLM abstraction layer for Spazzatura
 */

// Types
export * from './types.js';

// Base classes
export { BaseProvider, OpenAICompatibleProvider } from './base.js';

// Configuration
export {
  loadConfig,
  loadConfigFile,
  mergeConfig,
  validateConfig,
  validateProviderConfig,
  getConfigFromEnv,
  getProviderConfigFromEnv,
  getDefaultProviderConfig,
  getDefaultRoutingConfig,
} from './config.js';

// Auth utilities
export {
  CookieManager,
  cookieManager,
} from './auth/cookie-manager.js';

export {
  SessionManager,
  sessionManager,
} from './auth/session-manager.js';

export {
  ProxyManager,
  proxyManager,
} from './auth/proxy-manager.js';

export type { ProxyEntry } from './auth/proxy-manager.js';

// Provider implementations
export {
  // Classes
  MiniMaxProvider,
  QwenProvider,
  GPT4FreeProvider,
  GLMProvider,
  OpenAIProvider,
  AnthropicProvider,
  OpenRouterProvider,
  OllamaProvider,
  Chat2APIProvider,
  ClaudeFreeProvider,
  WebAIProvider,
  AIClientProvider,
  FreeGLMProvider,
  GLMFreeProvider,
  GPT4FreeEnhancedProvider,
  // Constants
  OPENROUTER_FREE_MODELS,
  OPENROUTER_PREMIUM_MODELS,
  OLLAMA_DEFAULT_MODELS,
  // Factory functions
  createProvider,
  getAvailableProviderTypes,
  detectAvailableProviders,
  // Individual factory functions
  createMiniMaxProvider,
  createQwenProvider,
  createGPT4FreeProvider,
  createGLMProvider,
  createOpenAIProvider,
  createAnthropicProvider,
  createOpenRouterProvider,
  createOllamaProvider,
  createChat2APIProvider,
  createClaudeFreeProvider,
  createWebAIProvider,
  createAIClientProvider,
  createFreeGLMProvider,
  createGLMFreeProvider,
  createGPT4FreeEnhancedProvider,
  // Pre-configured instances
  minimaxProvider,
  qwenProvider,
  gpt4freeProvider,
  glmProvider,
  chat2apiProvider,
  claudeFreeProvider,
  webaiProvider,
  aiclientProvider,
  freeglmProvider,
  glmFreeProvider,
  gpt4freeEnhancedProvider,
  // Types
  type ProviderMap,
} from './providers/index.js';

// Router
export {
  ProviderRouter,
  createRouter,
} from './router.js';

// Manager
export {
  ProviderManager,
  createProviderManager,
  createProviderManagerFromFile,
  createProviderManagerFromEnv,
} from './manager.js';

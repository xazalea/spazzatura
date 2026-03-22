/**
 * Provider exports
 * Re-exports all provider implementations
 */

import { MiniMaxProvider } from './minimax.js';
import { QwenProvider } from './qwen.js';
import { GPT4FreeProvider } from './gpt4free.js';
import { GLMProvider } from './glm.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenRouterProvider } from './openrouter.js';
import { OllamaProvider } from './ollama.js';
import { Chat2APIProvider } from './chat2api.js';
import { ClaudeFreeProvider } from './claude-free.js';
import { WebAIProvider } from './webai.js';
import { AIClientProvider } from './aiclient.js';
import { FreeGLMProvider } from './freeglm.js';
import { GLMFreeProvider } from './glm-free.js';
import { GPT4FreeEnhancedProvider } from './gpt4free-enhanced.js';
import type { Provider, ProviderConfig, ExtendedProviderType } from '../types.js';

// Re-export provider classes
export { MiniMaxProvider } from './minimax.js';
export { QwenProvider } from './qwen.js';
export { GPT4FreeProvider } from './gpt4free.js';
export { GLMProvider } from './glm.js';
export { OpenAIProvider } from './openai.js';
export { AnthropicProvider } from './anthropic.js';
export { OpenRouterProvider, OPENROUTER_FREE_MODELS, OPENROUTER_PREMIUM_MODELS } from './openrouter.js';
export { OllamaProvider, OLLAMA_DEFAULT_MODELS } from './ollama.js';
export { Chat2APIProvider } from './chat2api.js';
export { ClaudeFreeProvider } from './claude-free.js';
export { WebAIProvider } from './webai.js';
export { AIClientProvider } from './aiclient.js';
export { FreeGLMProvider } from './freeglm.js';
export { GLMFreeProvider } from './glm-free.js';
export { GPT4FreeEnhancedProvider } from './gpt4free-enhanced.js';

// Re-export types
export type { MiniMaxConfig, MiniMaxVoice, TTSOptions, STTOptions } from './minimax.js';
export type { QwenConfig, ImageGenerationOptions, ImageGenerationResponse } from './qwen.js';
export type { GPT4FreeConfig, SiteInfo } from './gpt4free.js';
export type { GLMConfig, GLMImageOptions, GLMVideoOptions } from './glm.js';
export type { OpenAIConfig, OpenAIVoice, OpenAITTSOptions, OpenAISTTOptions, OpenAIImageOptions } from './openai.js';
export type { AnthropicConfig } from './anthropic.js';
export type { OpenRouterConfig } from './openrouter.js';
export type { OllamaConfig } from './ollama.js';
export type { Chat2APIConfig } from './chat2api.js';
export type { ClaudeFreeConfig } from './claude-free.js';
export type { WebAIConfig } from './webai.js';
export type { AIClientConfig } from './aiclient.js';
export type { FreeGLMConfig } from './freeglm.js';
export type { GLMFreeConfig } from './glm-free.js';
export type { GPT4FreeEnhancedConfig } from './gpt4free-enhanced.js';

// Re-export factory functions
export { createMiniMaxProvider, minimaxProvider } from './minimax.js';
export { createQwenProvider, qwenProvider } from './qwen.js';
export { createGPT4FreeProvider, gpt4freeProvider } from './gpt4free.js';
export { createGLMProvider, glmProvider } from './glm.js';
export { createOpenAIProvider } from './openai.js';
export { createAnthropicProvider } from './anthropic.js';
export { createOpenRouterProvider } from './openrouter.js';
export { createOllamaProvider } from './ollama.js';
export { createChat2APIProvider, chat2apiProvider } from './chat2api.js';
export { createClaudeFreeProvider, claudeFreeProvider } from './claude-free.js';
export { createWebAIProvider, webaiProvider } from './webai.js';
export { createAIClientProvider, aiclientProvider } from './aiclient.js';
export { createFreeGLMProvider, freeglmProvider } from './freeglm.js';
export { createGLMFreeProvider, glmFreeProvider } from './glm-free.js';
export { createGPT4FreeEnhancedProvider, gpt4freeEnhancedProvider } from './gpt4free-enhanced.js';

/**
 * Provider type map
 */
export type ProviderMap = {
  minimax: MiniMaxProvider;
  qwen: QwenProvider;
  gpt4free: GPT4FreeProvider;
  glm: GLMProvider;
  openai: OpenAIProvider;
  anthropic: AnthropicProvider;
  openrouter: OpenRouterProvider;
  ollama: OllamaProvider;
  chat2api: Chat2APIProvider;
  'claude-free': ClaudeFreeProvider;
  webai: WebAIProvider;
  aiclient: AIClientProvider;
  freeglm: FreeGLMProvider;
  'glm-free': GLMFreeProvider;
  'gpt4free-enhanced': GPT4FreeEnhancedProvider;
};

/**
 * Create a provider instance based on type
 */
export function createProvider(
  type: ExtendedProviderType,
  config: ProviderConfig
): Provider {
  switch (type) {
    case 'minimax':
      return new MiniMaxProvider(config as unknown as Partial<import('./minimax.js').MiniMaxConfig>);
    case 'qwen':
      return new QwenProvider(config as unknown as Partial<import('./qwen.js').QwenConfig>);
    case 'gpt4free':
      return new GPT4FreeProvider(config as unknown as Partial<import('./gpt4free.js').GPT4FreeConfig>);
    case 'glm':
      return new GLMProvider(config as unknown as Partial<import('./glm.js').GLMConfig>);
    case 'openai': {
      if (!config.apiKey) {
        throw new Error('OpenAI provider requires an API key');
      }
      return new OpenAIProvider({
        ...(config as unknown as Partial<import('./openai.js').OpenAIConfig>),
        apiKey: config.apiKey,
      });
    }
    case 'anthropic': {
      if (!config.apiKey) {
        throw new Error('Anthropic provider requires an API key');
      }
      return new AnthropicProvider({
        ...(config as unknown as Partial<import('./anthropic.js').AnthropicConfig>),
        apiKey: config.apiKey,
      });
    }
    case 'openrouter': {
      if (!config.apiKey) {
        throw new Error('OpenRouter requires an API key (free tier available at openrouter.ai)');
      }
      return new OpenRouterProvider({
        ...(config as unknown as Partial<import('./openrouter.js').OpenRouterConfig>),
        apiKey: config.apiKey,
      });
    }
    case 'ollama':
      return new OllamaProvider(config as unknown as Partial<import('./ollama.js').OllamaConfig>);
    case 'chat2api':
      return new Chat2APIProvider(config as unknown as Partial<import('./chat2api.js').Chat2APIConfig>);
    case 'claude-free':
      return new ClaudeFreeProvider(config as unknown as Partial<import('./claude-free.js').ClaudeFreeConfig>);
    case 'webai':
      return new WebAIProvider(config as unknown as Partial<import('./webai.js').WebAIConfig>);
    case 'aiclient':
      return new AIClientProvider(config as unknown as Partial<import('./aiclient.js').AIClientConfig>);
    case 'freeglm':
      return new FreeGLMProvider(config as unknown as Partial<import('./freeglm.js').FreeGLMConfig>);
    case 'glm-free':
      return new GLMFreeProvider(config as unknown as Partial<import('./glm-free.js').GLMFreeConfig>);
    case 'gpt4free-enhanced':
      return new GPT4FreeEnhancedProvider(config as unknown as Partial<import('./gpt4free-enhanced.js').GPT4FreeEnhancedConfig>);
    // Alias types — backed by the closest compatible provider class
    case 'free-gpt4-web':
      return new GPT4FreeEnhancedProvider({
        ...(config as unknown as Partial<import('./gpt4free-enhanced.js').GPT4FreeEnhancedConfig>),
        baseUrl: config.baseUrl ?? 'http://localhost:3050',
      });
    case 'glm-free-xiaoY':
      return new GLMFreeProvider({
        ...(config as unknown as Partial<import('./glm-free.js').GLMFreeConfig>),
        baseUrl: config.baseUrl ?? 'http://localhost:3049',
      });
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

/**
 * Get all available provider types
 */
export function getAvailableProviderTypes(): ExtendedProviderType[] {
  return [
    'gpt4free', 'chat2api', 'glm-free', 'claude-free', 'webai', 'aiclient',
    'freeglm', 'gpt4free-enhanced', 'ollama', 'openrouter', 'qwen', 'minimax',
    'glm', 'openai', 'anthropic',
  ];
}

/**
 * Auto-detect available providers from environment
 */
export function detectAvailableProviders(): Array<{ type: ExtendedProviderType; configured: boolean; free: boolean }> {
  return [
    {
      type: 'anthropic',
      configured: !!process.env['ANTHROPIC_API_KEY'],
      free: false,
    },
    {
      type: 'openai',
      configured: !!process.env['OPENAI_API_KEY'],
      free: false,
    },
    {
      type: 'openrouter',
      configured: !!process.env['OPENROUTER_API_KEY'],
      free: false, // Free tier available but needs key
    },
    {
      type: 'ollama',
      configured: true, // No key needed
      free: true,
    },
    {
      type: 'gpt4free',
      configured: true, // No key needed
      free: true,
    },
    {
      type: 'minimax',
      // Free via minimax-free-api proxy (port 3047) — needs MINIMAX_COOKIE after `spaz auth minimax`
      configured: !!(process.env['MINIMAX_API_KEY'] || process.env['MINIMAX_COOKIE']),
      free: true,
    },
    {
      type: 'qwen',
      // Free via qwen-free-api proxy (port 3045) — needs QWEN_COOKIE after `spaz auth qwen`
      configured: !!(process.env['QWEN_API_KEY'] || process.env['QWEN_COOKIE']),
      free: true,
    },
    {
      type: 'glm',
      // Free via glm-free-api proxy (port 3046) — needs GLM_COOKIE after `spaz auth chatglm`
      configured: !!(process.env['GLM_API_KEY'] || process.env['GLM_COOKIE'] || process.env['GLM_FREE_COOKIE']),
      free: true,
    },
    {
      type: 'chat2api',
      configured: true, // Works without cookie for public instances
      free: true,
    },
    {
      type: 'claude-free',
      configured: !!process.env['CLAUDE_FREE_COOKIE'],
      free: true,
    },
    {
      type: 'webai',
      configured: true, // No key needed
      free: true,
    },
    {
      type: 'aiclient',
      configured: true, // No key needed (cookie optional)
      free: true,
    },
    {
      type: 'freeglm',
      configured: true, // No auth required
      free: true,
    },
    {
      type: 'glm-free',
      configured: !!process.env['GLM_FREE_COOKIE'],
      free: true,
    },
    {
      type: 'gpt4free-enhanced',
      configured: true,
      free: true,
    },
    {
      type: 'free-gpt4-web',
      configured: true, // vendor/free-gpt4-web Python Flask service
      free: true,
    },
    {
      type: 'glm-free-xiaoY',
      configured: !!(process.env['GLM_FREE_COOKIE'] || process.env['GLM_XIAOYI_COOKIE']),
      free: true,
    },
  ];
}

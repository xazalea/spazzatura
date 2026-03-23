/**
 * Provider configuration management
 * Handles environment variables, configuration files, and defaults
 */

import type {
  ProviderConfig,
  ProviderManagerConfig,
  RoutingConfig,
  ExtendedProviderType,
  ProviderCapabilities,
} from './types.js';

/**
 * Environment variable mappings for providers
 */
const ENV_MAPPINGS: Record<string, Record<string, string>> = {
  minimax: {
    apiKey: 'MINIMAX_API_KEY',
    token: 'MINIMAX_TOKEN',
    cookie: 'MINIMAX_COOKIE',
    baseUrl: 'MINIMAX_BASE_URL',
  },
  qwen: {
    apiKey: 'QWEN_API_KEY',
    cookie: 'QWEN_COOKIE',
    baseUrl: 'QWEN_BASE_URL',
  },
  gpt4free: {
    baseUrl: 'GPT4FREE_BASE_URL',
  },
  glm: {
    apiKey: 'GLM_API_KEY',
    cookie: 'GLM_COOKIE',
    baseUrl: 'GLM_BASE_URL',
  },
  openai: {
    apiKey: 'OPENAI_API_KEY',
    baseUrl: 'OPENAI_BASE_URL',
  },
  anthropic: {
    apiKey: 'ANTHROPIC_API_KEY',
    baseUrl: 'ANTHROPIC_BASE_URL',
  },
  openrouter: {
    apiKey: 'OPENROUTER_API_KEY',
    baseUrl: 'OPENROUTER_BASE_URL',
  },
  ollama: {
    baseUrl: 'OLLAMA_HOST',
  },
  chat2api: {
    cookie: 'CHAT2API_COOKIE',
    baseUrl: 'CHAT2API_BASE_URL',
  },
  'claude-free': {
    cookie: 'CLAUDE_FREE_COOKIE',
    baseUrl: 'CLAUDE_FREE_BASE_URL',
  },
  webai: {
    baseUrl: 'WEBAI_BASE_URL',
  },
  aiclient: {
    cookie: 'AICLIENT_COOKIE',
    baseUrl: 'AICLIENT_BASE_URL',
  },
  freeglm: {
    baseUrl: 'FREEGLM_BASE_URL',
  },
  'glm-free': {
    cookie: 'GLM_FREE_COOKIE',
    baseUrl: 'GLM_FREE_BASE_URL',
  },
  'gpt4free-enhanced': {
    baseUrl: 'GPT4FREE_ENHANCED_BASE_URL',
  },
};

/**
 * Default base URLs for providers
 */
const DEFAULT_BASE_URLS: Record<ExtendedProviderType, string> = {
  minimax: 'http://localhost:3047',    // minimax-free-api submodule
  qwen: 'http://localhost:3045',       // qwen-free-api submodule
  gpt4free: 'http://localhost:8080',
  glm: 'http://localhost:3046',        // glm-free-api submodule
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  openrouter: 'https://openrouter.ai/api',
  ollama: 'http://localhost:11434',
  custom: '',
  chat2api: 'http://localhost:3040',     // vendor/chat2api (Electron app, optional)
  'claude-free': 'https://claude.ai',
  webai: 'http://localhost:8001',        // vendor/webai-api (Python, Gemini)
  aiclient: 'http://localhost:3048',     // vendor/aiclient-api (Node.js)
  freeglm: 'http://localhost:33333',     // vendor/freeglm (Express proxy)
  'glm-free': 'http://localhost:3046',   // glm-free-api (LLM-Red-Team) submodule
  'gpt4free-enhanced': 'http://localhost:3051', // vendor/gpt4free-ts
  'free-gpt4-web': 'http://localhost:3050',     // vendor/free-gpt4-web (Python Flask)
  'glm-free-xiaoY': 'http://localhost:3049',    // vendor/glm-free-xiaoY
  gemini: 'https://gemini.google.com',
};

/**
 * Default models for providers
 */
const DEFAULT_MODELS: Record<ExtendedProviderType, string[]> = {
  // LLM-Red-Team/minimax-free-api — hailuoai.com web session proxy
  minimax: ['hailuo', 'MiniMax-Text-01', 'MiniMax-VL-01'],
  // LLM-Red-Team/qwen-free-api — tongyi.aliyun.com web session proxy
  qwen: ['qwen', 'qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-long'],
  gpt4free: ['gpt-3.5-turbo', 'gpt-4'],
  // LLM-Red-Team/glm-free-api — chatglm.cn web session proxy
  glm: ['glm-4-plus', 'glm-4', 'glm-4-zero', 'glm-4-think', 'glm-4-flash', 'cogview-3'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini', 'o3-mini'],
  anthropic: [
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
    'claude-3-5-sonnet-20241022',
  ],
  openrouter: [
    'meta-llama/llama-3.2-3b-instruct:free',
    'anthropic/claude-3-5-sonnet',
    'openai/gpt-4o',
    'google/gemini-flash-1.5',
    'deepseek/deepseek-chat',
  ],
  ollama: ['llama3.2', 'mistral', 'codellama', 'deepseek-coder-v2'],
  custom: [],
  // xiaoY233/Chat2API — multi-provider Chinese AI web session proxy
  chat2api: [
    'DeepSeek-V3.2', 'GLM-5', 'GLM-4.7', 'GLM-4.6V', 'GLM-4.6',
    'kimi-k2.5', 'MiniMax-M2.5',
    'Qwen3.5-Plus', 'Qwen3-Max', 'Qwen3-Flash', 'Qwen3-Coder', 'qwen-max-latest',
  ],
  // KoushikNavuluri/Claude-API — claude.ai web session proxy
  'claude-free': ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-haiku', 'claude-2'],
  // Amm1rr/WebAI-to-API — Google Gemini web session proxy
  webai: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
  // justlovemaki/AIClient-2-API — multi-provider proxy
  aiclient: ['claude-3-5-sonnet-20241022', 'gemini-1.5-pro', 'Qwen3-Coder-Plus', 'Kimi-K2'],
  // wangshengithub/FREEGLM — Zhipu open.bigmodel.cn proxy
  freeglm: ['glm-4-flash', 'glm-4-air', 'glm-4'],
  // xiaoY233/GLM-Free-API — GLM alternative proxy
  'glm-free': ['glm-4', 'glm-4-plus', 'glm-4-flash'],
  // xiangsx/gpt4free-ts — gpt4free TypeScript server
  'gpt4free-enhanced': ['gpt-4', 'gpt-3.5-turbo'],
  // aledipa/Free-GPT4-WEB-API — Python Flask GPT-4 proxy
  'free-gpt4-web': ['gpt-4', 'gpt-4o'],
  'glm-free-xiaoY': ['glm-4', 'glm-4-flash', 'glm-4-plus'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
};

/**
 * Default provider capabilities
 */
const DEFAULT_CAPABILITIES: Record<ExtendedProviderType, ProviderCapabilities> = {
  minimax: {
    chat: true,
    streaming: true,
    vision: true,
    tts: true,
    stt: true,
    imageGeneration: false,
    embedding: false,
    functionCalling: true,
    maxContextLength: 128000,
  },
  qwen: {
    chat: true,
    streaming: true,
    vision: true,
    tts: false,
    stt: false,
    imageGeneration: true,
    embedding: true,
    functionCalling: true,
    maxContextLength: 32000,
  },
  gpt4free: {
    chat: true,
    streaming: true,
    vision: false,
    tts: false,
    stt: false,
    imageGeneration: false,
    embedding: false,
    functionCalling: false,
    maxContextLength: 16000,
  },
  glm: {
    chat: true,
    streaming: true,
    vision: true,
    tts: false,
    stt: false,
    imageGeneration: true,
    embedding: false,
    functionCalling: true,
    maxContextLength: 128000,
  },
  openai: {
    chat: true,
    streaming: true,
    vision: true,
    tts: true,
    stt: true,
    imageGeneration: true,
    embedding: true,
    functionCalling: true,
    maxContextLength: 128000,
  },
  anthropic: {
    chat: true,
    streaming: true,
    vision: true,
    tts: false,
    stt: false,
    imageGeneration: false,
    embedding: false,
    functionCalling: true,
    maxContextLength: 200000,
  },
  openrouter: {
    chat: true,
    streaming: true,
    vision: true,
    tts: false,
    stt: false,
    imageGeneration: false,
    embedding: false,
    functionCalling: true,
    maxContextLength: 200000,
  },
  ollama: {
    chat: true,
    streaming: true,
    vision: true,
    tts: false,
    stt: false,
    imageGeneration: false,
    embedding: true,
    functionCalling: true,
    maxContextLength: 128000,
  },
  custom: {
    chat: true,
    streaming: true,
    vision: false,
    tts: false,
    stt: false,
    imageGeneration: false,
    embedding: false,
    functionCalling: false,
    maxContextLength: 4096,
  },
  chat2api: {
    chat: true,
    streaming: true,
    vision: false,
    tts: false,
    stt: false,
    imageGeneration: false,
    embedding: false,
    functionCalling: false,
    maxContextLength: 32000,
  },
  'claude-free': {
    chat: true,
    streaming: true,
    vision: false,
    tts: false,
    stt: false,
    imageGeneration: false,
    embedding: false,
    functionCalling: false,
    maxContextLength: 32000,
  },
  webai: {
    chat: true,
    streaming: true,
    vision: false,
    tts: false,
    stt: false,
    imageGeneration: false,
    embedding: false,
    functionCalling: false,
    maxContextLength: 32000,
  },
  aiclient: {
    chat: true,
    streaming: true,
    vision: false,
    tts: false,
    stt: false,
    imageGeneration: false,
    embedding: false,
    functionCalling: false,
    maxContextLength: 32000,
  },
  freeglm: {
    chat: true,
    streaming: true,
    vision: false,
    tts: false,
    stt: false,
    imageGeneration: false,
    embedding: false,
    functionCalling: false,
    maxContextLength: 32000,
  },
  'glm-free': {
    chat: true,
    streaming: true,
    vision: false,
    tts: false,
    stt: false,
    imageGeneration: false,
    embedding: false,
    functionCalling: false,
    maxContextLength: 32000,
  },
  'gpt4free-enhanced': {
    chat: true,
    streaming: true,
    vision: false,
    tts: false,
    stt: false,
    imageGeneration: false,
    embedding: false,
    functionCalling: false,
    maxContextLength: 32000,
  },
  'free-gpt4-web': {
    chat: true,
    streaming: true,
    vision: false,
    tts: false,
    stt: false,
    imageGeneration: false,
    embedding: false,
    functionCalling: false,
    maxContextLength: 32000,
  },
  'glm-free-xiaoY': {
    chat: true,
    streaming: true,
    vision: false,
    tts: false,
    stt: false,
    imageGeneration: false,
    embedding: false,
    functionCalling: false,
    maxContextLength: 32000,
  },
  gemini: {
    chat: true,
    streaming: true,
    vision: true,
    tts: false,
    stt: false,
    imageGeneration: false,
    embedding: false,
    functionCalling: false,
    maxContextLength: 1000000,
  },
};

/**
 * Mutable provider config for building configurations
 */
interface MutableProviderConfig {
  name: string;
  type: ExtendedProviderType;
  baseUrl?: string;
  apiKey?: string;
  cookie?: string;
  token?: string;
  defaultModel?: string | undefined;
  models?: string[] | undefined;
  timeout?: number;
  maxRetries?: number;
  enabled?: boolean;
  headers?: Record<string, string>;
}

/**
 * Mutable routing config for building configurations
 */
interface MutableRoutingConfig {
  strategy: RoutingConfig['strategy'];
  failoverOrder?: string[] | undefined;
  featureBased?: RoutingConfig['featureBased'] | undefined;
  healthCheckInterval?: number | undefined;
  autoFailover?: boolean | undefined;
}

/**
 * Mutable manager config for building configurations
 */
interface MutableManagerConfig {
  providers: Record<string, MutableProviderConfig>;
  routing?: MutableRoutingConfig;
  defaultProvider?: string | undefined;
}

/**
 * Get environment variable value
 */
function getEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

/**
 * Parse a boolean environment variable
 */
function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Get provider configuration from environment variables
 */
export function getProviderConfigFromEnv(name: string): Partial<MutableProviderConfig> {
  const mapping = ENV_MAPPINGS[name];
  if (!mapping) {
    return {};
  }

  const config: Partial<MutableProviderConfig> = {
    name,
    type: name as ExtendedProviderType,
  };

  // Map environment variables to config
  for (const [configKey, envKey] of Object.entries(mapping)) {
    const value = getEnv(envKey);
    if (value) {
      (config as Record<string, unknown>)[configKey] = value;
    }
  }

  // Check if provider is enabled via environment
  const enabledEnv = getEnv(`${name.toUpperCase()}_ENABLED`);
  if (enabledEnv !== undefined) {
    config.enabled = parseBoolean(enabledEnv);
  }

  return config;
}

/**
 * Get default provider configuration
 */
export function getDefaultProviderConfig(name: string): ProviderConfig {
  const type = name as ExtendedProviderType;
  const envConfig = getProviderConfigFromEnv(name);
  const defaultModels = DEFAULT_MODELS[type];
  
  const config: MutableProviderConfig = {
    name,
    type,
    baseUrl: DEFAULT_BASE_URLS[type],
    models: defaultModels,
    timeout: 30000,
    maxRetries: 3,
    enabled: true,
  };

  // Set default model if models exist
  if (defaultModels.length > 0) {
    config.defaultModel = defaultModels[0];
  }

  // Merge with env config
  return {
    ...config,
    ...envConfig,
  } as ProviderConfig;
}

/**
 * Get default capabilities for a provider type
 */
export function getDefaultCapabilities(type: ExtendedProviderType): ProviderCapabilities {
  return DEFAULT_CAPABILITIES[type] ?? DEFAULT_CAPABILITIES.custom;
}

/**
 * Get default routing configuration
 */
export function getDefaultRoutingConfig(): RoutingConfig {
  // Priority: working providers first — ollama (local), then submodule services, then paid
  return {
    strategy: 'failover',
    // No-auth-required providers first; cookie-based providers after; paid APIs last
    failoverOrder: ['gpt4free', 'freeglm', 'gpt4free-enhanced', 'free-gpt4-web', 'webai', 'aiclient', 'ollama', 'qwen', 'glm', 'glm-free', 'glm-free-xiaoY', 'minimax', 'chat2api', 'claude-free', 'openrouter', 'openai', 'anthropic'],
    featureBased: {
      tts: 'openai',
      stt: 'openai',
      imageGeneration: 'openai',
      vision: 'anthropic',
      embedding: 'openai',
    },
    healthCheckInterval: 60000,
    autoFailover: true,
  };
}

/**
 * Get complete provider manager configuration from environment
 */
export function getConfigFromEnv(): ProviderManagerConfig {
  const providers: Record<string, ProviderConfig> = {};
  
  // Load all known providers from environment
  for (const name of Object.keys(ENV_MAPPINGS)) {
    const config = getProviderConfigFromEnv(name);
    if (Object.keys(config).length > 0) {
      providers[name] = {
        ...getDefaultProviderConfig(name),
        ...config,
      } as ProviderConfig;
    }
  }

  // Get default provider from environment
  const defaultProvider = getEnv('DEFAULT_PROVIDER') || getEnv('SPAZZATURA_DEFAULT_PROVIDER');

  // Get routing strategy from environment
  const routingStrategy = getEnv('ROUTING_STRATEGY') || getEnv('SPAZZATURA_ROUTING_STRATEGY');

  const defaultRouting = getDefaultRoutingConfig();
  const routing: MutableRoutingConfig = {
    strategy: routingStrategy ? routingStrategy as RoutingConfig['strategy'] : defaultRouting.strategy,
    failoverOrder: defaultRouting.failoverOrder ? [...defaultRouting.failoverOrder] : undefined,
    featureBased: defaultRouting.featureBased,
    healthCheckInterval: defaultRouting.healthCheckInterval,
    autoFailover: defaultRouting.autoFailover,
  };

  // Convert providers to mutable format
  const mutableProviders: Record<string, MutableProviderConfig> = {};
  for (const [name, providerConfig] of Object.entries(providers)) {
    mutableProviders[name] = {
      ...providerConfig,
      models: providerConfig.models ? [...providerConfig.models] : undefined,
    } as MutableProviderConfig;
  }

  const result: MutableManagerConfig = {
    providers: mutableProviders,
    routing,
  };

  if (defaultProvider) {
    result.defaultProvider = defaultProvider;
  }

  return result as ProviderManagerConfig;
}

/**
 * Load configuration from a file
 */
export async function loadConfigFile(path: string): Promise<ProviderManagerConfig> {
  try {
    const fs = await import('fs/promises');
    const content = await fs.readFile(path, 'utf-8');
    
    // Parse based on file extension
    if (path.endsWith('.json')) {
      return JSON.parse(content) as ProviderManagerConfig;
    }
    
    if (path.endsWith('.yaml') || path.endsWith('.yml')) {
      // Simple YAML parsing for basic config structure
      // For production, consider using a proper YAML library
      return parseSimpleYaml(content);
    }
    
    throw new Error(`Unsupported config file format: ${path}`);
  } catch (error) {
    throw new Error(`Failed to load config file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Simple YAML parser for basic config structure
 * Note: For production use, consider using 'yaml' or 'js-yaml' library
 */
function parseSimpleYaml(content: string): ProviderManagerConfig {
  const config: MutableManagerConfig = {
    providers: {},
  };
  
  const lines = content.split('\n');
  let currentSection = '';
  let currentProvider = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Section headers
    if (trimmed === 'providers:') {
      currentSection = 'providers';
      continue;
    }
    
    if (trimmed === 'routing:') {
      currentSection = 'routing';
      continue;
    }
    
    // Provider entries
    if (currentSection === 'providers' && trimmed.endsWith(':')) {
      currentProvider = trimmed.slice(0, -1);
      config.providers[currentProvider] = {
        name: currentProvider,
        type: currentProvider as ExtendedProviderType,
      };
      continue;
    }
    
    // Provider properties
    if (currentSection === 'providers' && currentProvider && trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();
      
      if (key && value) {
        const providerConfig = config.providers[currentProvider];
        
        // Handle environment variable references
        let finalValue: string | boolean | string[] = value;
        if (value.startsWith('${') && value.endsWith('}')) {
          const envKey = value.slice(2, -1);
          finalValue = getEnv(envKey) || value;
        } else if (value === 'true') {
          finalValue = true;
        } else if (value === 'false') {
          finalValue = false;
        } else if (value.startsWith('[') && value.endsWith(']')) {
          // Simple array parsing
          finalValue = value.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''));
        }
        
        (providerConfig as unknown as Record<string, unknown>)[key.trim()] = finalValue;
      }
    }
    
    // Routing properties
    if (currentSection === 'routing' && trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();
      
      if (key && value) {
        if (!config.routing) {
          config.routing = { ...getDefaultRoutingConfig() } as MutableRoutingConfig;
        }
        
        if (key.trim() === 'strategy') {
          config.routing.strategy = value as RoutingConfig['strategy'];
        } else if (key.trim() === 'order' && value.startsWith('[')) {
          config.routing.failoverOrder = value.slice(1, -1).split(',').map(s => s.trim());
        }
      }
    }
  }
  
  return config as ProviderManagerConfig;
}

/**
 * Merge configurations with defaults
 */
export function mergeConfig(
  ...configs: Array<Partial<ProviderManagerConfig> | undefined>
): ProviderManagerConfig {
  const result: MutableManagerConfig = {
    providers: {},
    routing: { ...getDefaultRoutingConfig() } as MutableRoutingConfig,
  };

  for (const config of configs) {
    if (!config) continue;

    if (config.providers) {
      for (const [name, providerConfig] of Object.entries(config.providers)) {
        result.providers[name] = {
          ...getDefaultProviderConfig(name),
          ...result.providers[name],
          ...providerConfig,
        } as MutableProviderConfig;
      }
    }

    if (config.routing) {
      const mergedRouting: MutableRoutingConfig = {
        strategy: config.routing.strategy ?? result.routing!.strategy,
        failoverOrder: config.routing.failoverOrder ? [...config.routing.failoverOrder] : result.routing!.failoverOrder,
        featureBased: config.routing.featureBased ?? result.routing!.featureBased,
        healthCheckInterval: config.routing.healthCheckInterval ?? result.routing!.healthCheckInterval,
        autoFailover: config.routing.autoFailover ?? result.routing!.autoFailover,
      };
      result.routing = mergedRouting;
    }

    if (config.defaultProvider) {
      result.defaultProvider = config.defaultProvider;
    }
  }

  return result as ProviderManagerConfig;
}

/**
 * Load configuration from multiple sources
 * Priority: file > environment > defaults
 */
export async function loadConfig(configPath?: string): Promise<ProviderManagerConfig> {
  const envConfig = getConfigFromEnv();
  
  if (configPath) {
    try {
      const fileConfig = await loadConfigFile(configPath);
      return mergeConfig(fileConfig, envConfig);
    } catch (error) {
      console.warn(`Failed to load config file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Try default config paths
  const defaultPaths = [
    'spazzatura.yaml',
    'spazzatura.yml',
    'spazzatura.json',
    '.spazzatura.yaml',
    '.spazzatura.json',
  ];
  
  for (const path of defaultPaths) {
    try {
      const fileConfig = await loadConfigFile(path);
      return mergeConfig(fileConfig, envConfig);
    } catch {
      // Continue to next path
    }
  }
  
  return envConfig;
}

/**
 * Validate provider configuration
 */
export function validateProviderConfig(config: ProviderConfig): string[] {
  const errors: string[] = [];

  if (!config.name) {
    errors.push('Provider name is required');
  }

  if (!config.type) {
    errors.push('Provider type is required');
  }

  // Check for required authentication
  const type = config.type as ExtendedProviderType;
  if (type === 'openai' && !config.apiKey) {
    errors.push('OpenAI provider requires an API key');
  }

  if (type === 'anthropic' && !config.apiKey) {
    errors.push('Anthropic provider requires an API key');
  }

  // Validate models
  if (config.models && config.models.length === 0) {
    errors.push('Provider must have at least one model');
  }

  // Validate timeout
  if (config.timeout !== undefined && config.timeout < 1000) {
    errors.push('Timeout must be at least 1000ms');
  }

  // Validate maxRetries
  if (config.maxRetries !== undefined && config.maxRetries < 0) {
    errors.push('maxRetries must be non-negative');
  }

  return errors;
}

/**
 * Validate complete configuration
 */
export function validateConfig(config: ProviderManagerConfig): string[] {
  const errors: string[] = [];

  // Validate providers
  if (config.providers) {
    for (const [name, providerConfig] of Object.entries(config.providers)) {
      const providerErrors = validateProviderConfig(providerConfig);
      for (const error of providerErrors) {
        errors.push(`Provider '${name}': ${error}`);
      }
    }
  }

  // Validate default provider
  if (config.defaultProvider && !config.providers?.[config.defaultProvider]) {
    errors.push(`Default provider '${config.defaultProvider}' not found in providers`);
  }

  // Validate routing
  if (config.routing) {
    if (config.routing.failoverOrder) {
      for (const name of config.routing.failoverOrder) {
        if (!config.providers?.[name]) {
          errors.push(`Failover provider '${name}' not found in providers`);
        }
      }
    }

    if (config.routing.featureBased) {
      for (const [feature, provider] of Object.entries(config.routing.featureBased)) {
        if (provider && !config.providers?.[provider]) {
          errors.push(`Feature-based routing provider '${provider}' for ${feature} not found`);
        }
      }
    }
  }

  return errors;
}

// Re-export types for convenience
export type { ProviderConfig, ProviderManagerConfig, RoutingConfig, ExtendedProviderType };

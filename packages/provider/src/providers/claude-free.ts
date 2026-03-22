/**
 * Claude Free Provider
 *
 * Unofficial Claude web API provider (KoushikNavuluri/Claude-API pattern).
 * Interacts with claude.ai web frontend endpoints using a browser session
 * cookie. NOT OpenAI-compatible – uses a custom request format.
 *
 * Authentication: CLAUDE_FREE_COOKIE env var (required for web session)
 */

import type {
  Provider,
  ProviderConfig,
  ProviderCapabilities,
  ProviderStatus,
  Message,
  ChatOptions,
  ChatResponse,
  StreamChunk,
} from '../types.js';
import { ProviderError } from '../types.js';
import { getDefaultCapabilities } from '../config.js';

/**
 * Claude Free provider configuration
 */
export interface ClaudeFreeConfig extends ProviderConfig {
  type: 'claude-free';
  /** Browser session cookie for claude.ai */
  cookie?: string;
  /** Organisation UUID extracted from claude.ai (auto-detected if not set) */
  organizationId?: string;
}

/**
 * Claude Free Provider implementation
 *
 * Talks directly to the claude.ai web API using a session cookie.
 * Does not extend OpenAICompatibleProvider because the API surface
 * differs significantly from the OpenAI spec.
 */
export class ClaudeFreeProvider implements Provider {
  readonly name = 'claude-free';
  readonly type = 'claude-free' as const;
  readonly capabilities: ProviderCapabilities;
  readonly config: ProviderConfig;

  private readonly baseUrl: string;
  private readonly cookie: string | undefined;
  private readonly timeout: number;
  private organizationId: string | undefined;

  constructor(config: Partial<ClaudeFreeConfig> = {}) {
    const cookie = config.cookie ?? process.env['CLAUDE_FREE_COOKIE'];
    const fullConfig: ProviderConfig = {
      name: 'claude-free',
      type: 'claude-free',
      baseUrl: config.baseUrl ?? process.env['CLAUDE_FREE_BASE_URL'] ?? 'https://claude.ai',
      models: config.models ?? ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'],
      defaultModel: config.defaultModel ?? 'claude-3-sonnet',
      timeout: config.timeout ?? 60000,
      maxRetries: config.maxRetries ?? 3,
      enabled: config.enabled ?? true,
      ...(cookie !== undefined ? { cookie } : {}),
      ...config,
    };

    this.config = fullConfig;
    this.capabilities = getDefaultCapabilities('claude-free');
    this.baseUrl = fullConfig.baseUrl ?? 'https://claude.ai';
    this.cookie = cookie;
    this.timeout = fullConfig.timeout ?? 60000;
    this.organizationId = config.organizationId;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; Spazzatura/1.0)',
      'Accept': 'application/json',
      'Referer': `${this.baseUrl}/`,
      'Origin': this.baseUrl,
    };

    if (this.cookie) {
      headers['Cookie'] = this.cookie;
    }

    if (this.config.headers) {
      Object.assign(headers, this.config.headers);
    }

    return headers;
  }

  private createAbortSignal(ms?: number): AbortSignal {
    return AbortSignal.timeout(ms ?? this.timeout);
  }

  /**
   * Resolve the organisation ID from the claude.ai API
   */
  private async resolveOrganizationId(): Promise<string> {
    if (this.organizationId) return this.organizationId;

    const response = await fetch(`${this.baseUrl}/api/organizations`, {
      method: 'GET',
      headers: this.buildHeaders(),
      signal: this.createAbortSignal(10000),
    });

    if (!response.ok) {
      throw new ProviderError(
        `Failed to fetch organizations: ${response.status}`,
        this.name,
        response.status.toString(),
        response.status,
        response.status >= 500
      );
    }

    const orgs = await response.json() as Array<{ uuid: string }>;
    const id = orgs[0]?.uuid;
    if (!id) {
      throw new ProviderError('No organization found in claude.ai account', this.name);
    }

    this.organizationId = id;
    return id;
  }

  /**
   * Map model shorthand to the slug used by claude.ai
   */
  private resolveModelSlug(model: string): string {
    const slugMap: Record<string, string> = {
      'claude-3-haiku': 'claude-3-haiku-20240307',
      'claude-3-sonnet': 'claude-3-sonnet-20240229',
      'claude-3-opus': 'claude-3-opus-20240229',
    };
    return slugMap[model] ?? model;
  }

  async chat(messages: readonly Message[], options?: ChatOptions): Promise<ChatResponse> {
    const orgId = await this.resolveOrganizationId();
    const model = this.resolveModelSlug(
      options?.model ?? this.config.defaultModel ?? 'claude-3-sonnet'
    );

    // Convert messages to claude.ai format
    const humanMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'human',
        content: typeof m.content === 'string' ? m.content : m.content.map(p => ('text' in p ? p.text ?? '' : '')).join(''),
      }));

    const systemPrompt = messages.find(m => m.role === 'system');

    const body: Record<string, unknown> = {
      prompt: humanMessages[humanMessages.length - 1]?.content ?? '',
      model,
      timezone: 'UTC',
      attachments: [],
      files: [],
    };

    if (systemPrompt) {
      body['system_prompt'] = typeof systemPrompt.content === 'string'
        ? systemPrompt.content
        : (systemPrompt.content as Array<{ text?: string }>).map(p => p.text ?? '').join('');
    }

    const response = await fetch(
      `${this.baseUrl}/api/organizations/${orgId}/chat_conversations`,
      {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({ name: '', model }),
        signal: this.createAbortSignal(),
      }
    );

    if (!response.ok) {
      throw new ProviderError(
        `Failed to create conversation: ${response.status}`,
        this.name,
        response.status.toString(),
        response.status,
        response.status >= 500
      );
    }

    const conversation = await response.json() as { uuid: string };

    const msgResponse = await fetch(
      `${this.baseUrl}/api/organizations/${orgId}/chat_conversations/${conversation.uuid}/completion`,
      {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: this.createAbortSignal(),
      }
    );

    if (!msgResponse.ok) {
      const errorText = await msgResponse.text();
      throw new ProviderError(
        `Chat completion failed: ${msgResponse.status} - ${errorText}`,
        this.name,
        msgResponse.status.toString(),
        msgResponse.status,
        msgResponse.status === 429 || msgResponse.status >= 500
      );
    }

    // claude.ai streams SSE; collect all chunks
    const reader = msgResponse.body?.getReader();
    if (!reader) {
      throw new ProviderError('No response body', this.name);
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('event:')) continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6)) as { completion?: string; type?: string };
              if (json.completion) {
                fullContent += json.completion;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      content: fullContent,
      model,
    };
  }

  async *stream(messages: readonly Message[], options?: ChatOptions): AsyncIterable<StreamChunk> {
    const orgId = await this.resolveOrganizationId();
    const model = this.resolveModelSlug(
      options?.model ?? this.config.defaultModel ?? 'claude-3-sonnet'
    );

    const humanMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'human',
        content: typeof m.content === 'string' ? m.content : m.content.map(p => ('text' in p ? p.text ?? '' : '')).join(''),
      }));

    const body: Record<string, unknown> = {
      prompt: humanMessages[humanMessages.length - 1]?.content ?? '',
      model,
      timezone: 'UTC',
      attachments: [],
      files: [],
    };

    // Create conversation first
    const convResponse = await fetch(
      `${this.baseUrl}/api/organizations/${orgId}/chat_conversations`,
      {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({ name: '', model }),
        signal: this.createAbortSignal(),
      }
    );

    if (!convResponse.ok) {
      throw new ProviderError(
        `Failed to create conversation: ${convResponse.status}`,
        this.name,
        convResponse.status.toString(),
        convResponse.status,
        convResponse.status >= 500
      );
    }

    const conversation = await convResponse.json() as { uuid: string };

    const response = await fetch(
      `${this.baseUrl}/api/organizations/${orgId}/chat_conversations/${conversation.uuid}/completion`,
      {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: this.createAbortSignal(),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new ProviderError(
        `Stream request failed: ${response.status} - ${errorText}`,
        this.name,
        response.status.toString(),
        response.status,
        response.status === 429 || response.status >= 500
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new ProviderError('No response body', this.name);
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('event:')) continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6)) as { completion?: string; stop?: boolean };
              if (json.completion) {
                yield { delta: json.completion, done: false };
              }
              if (json.stop) {
                yield { delta: '', done: true };
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      yield { delta: '', done: true };
    } finally {
      reader.releaseLock();
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/organizations`, {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: this.createAbortSignal(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getHealth(): Promise<ProviderStatus> {
    const start = Date.now();
    try {
      const available = await this.isAvailable();
      return {
        name: this.name,
        available,
        latency: Date.now() - start,
        lastChecked: new Date(),
        models: this.getModels(),
        ...(available ? {} : { error: 'Provider unavailable (check cookie)' }),
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

  getModels(): readonly string[] {
    return this.config.models ?? ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'];
  }
}

export function createClaudeFreeProvider(config?: Partial<ClaudeFreeConfig>): ClaudeFreeProvider {
  return new ClaudeFreeProvider(config);
}

export const claudeFreeProvider = new ClaudeFreeProvider();

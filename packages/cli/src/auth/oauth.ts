/**
 * OAuth Manager for Spazzatura CLI
 *
 * Provides token storage and refresh for every provider the CLI supports.
 * Tokens are persisted in ~/.spazzatura/tokens.json (plain JSON, separate
 * from the encrypted auth.json used by the Playwright automator).
 *
 * For providers that require browser login (claude, chatgpt, qwen, minimax,
 * glm) the existing Playwright automator (automator.ts) is reused.  This
 * module wraps those flows and stores the results in tokens.json.
 *
 * Supported providers: claude, chatgpt, qwen, minimax, glm
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ── Token store ──────────────────────────────────────────────────────────────

const SPAZ_DIR    = join(homedir(), '.spazzatura');
const TOKENS_FILE = join(SPAZ_DIR, 'tokens.json');

/** Shape of an entry in tokens.json. */
export interface TokenResult {
  /** The bearer/session/cookie token value. */
  token: string;
  /** Unix ms timestamp when the token was acquired. */
  savedAt: number;
  /** Optional expiry timestamp (Unix ms). Absent = unknown expiry. */
  expiresAt?: number;
  /** Optional refresh token for providers that support OAuth refresh. */
  refreshToken?: string;
}

type TokenStore = Record<string, TokenResult>;

function ensureDir(): void {
  if (!existsSync(SPAZ_DIR)) mkdirSync(SPAZ_DIR, { recursive: true });
}

function readStore(): TokenStore {
  try {
    if (!existsSync(TOKENS_FILE)) return {};
    return JSON.parse(readFileSync(TOKENS_FILE, 'utf-8')) as TokenStore;
  } catch {
    return {};
  }
}

function writeStore(store: TokenStore): void {
  ensureDir();
  writeFileSync(TOKENS_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

// ── Provider refresh helpers ─────────────────────────────────────────────────

/**
 * Providers that can refresh a token via a simple HTTP call.
 * Returns the new token string, or undefined if refresh failed / not supported.
 */
const HTTP_REFRESH: Record<
  string,
  (token: string) => Promise<string | undefined>
> = {
  /** Qwen: exchange the SSO ticket for a fresh one via cookie */
  qwen: async (token: string) => {
    try {
      const res = await fetch('https://tongyi.aliyun.com/api/tokenRefresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `tongyi_sso_ticket=${token}`,
          'User-Agent': 'Mozilla/5.0',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return undefined;
      const data = (await res.json()) as Record<string, unknown>;
      const refreshed = data['token'] ?? data['access_token'];
      return typeof refreshed === 'string' ? refreshed : undefined;
    } catch {
      return undefined;
    }
  },

  /** GLM: exchange the refresh_token for a new JWT */
  glm: async (token: string) => {
    try {
      const res = await fetch('https://chatglm.cn/api/v1/token/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'Mozilla/5.0',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return undefined;
      const data = (await res.json()) as Record<string, unknown>;
      const newToken =
        (data['result'] as Record<string, unknown> | undefined)?.['token'] ??
        data['access_token'] ??
        data['token'];
      return typeof newToken === 'string' ? newToken : undefined;
    } catch {
      return undefined;
    }
  },

  /** MiniMax: no standard HTTP refresh endpoint — must re-login. */
  minimax: async () => undefined,

  /** Claude (claude.ai session): no public refresh endpoint. */
  claude: async () => undefined,

  /** ChatGPT / Chat2API session: no public refresh endpoint. */
  chatgpt: async () => undefined,
};

// ── OAuthManager class ───────────────────────────────────────────────────────

/**
 * OAuthManager — high-level interface for provider authentication.
 *
 * Usage:
 *   const mgr = new OAuthManager();
 *   const result = await mgr.login('qwen');
 *   const token  = await mgr.getToken('qwen');
 */
export class OAuthManager {
  /** Supported provider names. */
  static readonly PROVIDERS = ['claude', 'chatgpt', 'qwen', 'minimax', 'glm'] as const;

  // ── login ────────────────────────────────────────────────────────────────

  /**
   * Initiate a login flow for `provider`.
   *
   * For browser-based providers, this delegates to the Playwright automator
   * (runSingleAuth) and stores the resulting token.
   *
   * @param provider - One of the supported provider names.
   * @returns        TokenResult on success.
   * @throws         Error if login fails.
   */
  async login(provider: string): Promise<TokenResult> {
    this.assertProvider(provider);

    // Map CLI provider name → automator service name
    const serviceMap: Record<string, string> = {
      claude: 'claude',
      chatgpt: 'chatgpt',
      qwen: 'qwen',
      minimax: 'minimax',
      glm: 'chatglm',
    };
    const service = serviceMap[provider] ?? provider;

    // Delegate to the Playwright automator
    const { runSingleAuth } = await import('./automator.js');
    const result = await runSingleAuth(service);

    if (!result.success || !result.token) {
      throw new Error(
        `Login failed for ${provider}: ${result.error ?? 'no token returned'}`
      );
    }

    const tokenResult: TokenResult = {
      token: result.token,
      savedAt: Date.now(),
    };

    this.saveToken(provider, tokenResult);
    return tokenResult;
  }

  // ── refresh ──────────────────────────────────────────────────────────────

  /**
   * Attempt to refresh an existing token for `provider`.
   *
   * Falls back to a full re-login if HTTP refresh is not supported or fails.
   *
   * @param provider - Provider name.
   * @param token    - Current token value (used in the refresh request).
   * @returns        Fresh TokenResult.
   * @throws         Error if both refresh and re-login fail.
   */
  async refresh(provider: string, token: string): Promise<TokenResult> {
    this.assertProvider(provider);

    const refreshFn = HTTP_REFRESH[provider];
    if (refreshFn) {
      const newToken = await refreshFn(token);
      if (newToken) {
        const result: TokenResult = { token: newToken, savedAt: Date.now() };
        this.saveToken(provider, result);
        return result;
      }
    }

    // Fallback: full re-login
    return this.login(provider);
  }

  // ── getToken ─────────────────────────────────────────────────────────────

  /**
   * Retrieve the stored token for `provider`, or null if none is stored.
   *
   * Checks the tokens.json store first, then falls back to environment
   * variables set by the Playwright automator (injected at startup by
   * initAuth → injectTokensToEnv).
   *
   * @param provider - Provider name.
   */
  async getToken(provider: string): Promise<string | null> {
    // 1. Check tokens.json
    const stored = readStore()[provider];
    if (stored?.token) return stored.token;

    // 2. Fall back to environment variables
    const envMap: Record<string, string[]> = {
      claude:  ['CLAUDE_FREE_COOKIE'],
      chatgpt: ['CHAT2API_COOKIE', 'OPENAI_API_KEY'],
      qwen:    ['QWEN_COOKIE', 'QWEN_API_KEY'],
      minimax: ['MINIMAX_COOKIE', 'MINIMAX_TOKEN'],
      glm:     ['GLM_FREE_COOKIE', 'GLM_COOKIE'],
    };

    for (const envKey of envMap[provider] ?? []) {
      const val = process.env[envKey];
      if (val) return val;
    }

    return null;
  }

  // ── isExpired ────────────────────────────────────────────────────────────

  /**
   * Return true if the stored token for `provider` is expired or older
   * than `maxAgeMs` milliseconds (default 12 h).
   */
  isExpired(provider: string, maxAgeMs = 12 * 60 * 60 * 1000): boolean {
    const stored = readStore()[provider];
    if (!stored) return true;
    if (stored.expiresAt && Date.now() > stored.expiresAt) return true;
    if (Date.now() - stored.savedAt > maxAgeMs) return true;
    return false;
  }

  // ── revokeToken ──────────────────────────────────────────────────────────

  /**
   * Remove the stored token for `provider` from tokens.json.
   */
  revokeToken(provider: string): void {
    const store = readStore();
    delete store[provider];
    writeStore(store);
  }

  // ── listProviders ────────────────────────────────────────────────────────

  /**
   * List all providers that have a stored token in tokens.json.
   */
  listProviders(): string[] {
    return Object.keys(readStore());
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private saveToken(provider: string, result: TokenResult): void {
    const store = readStore();
    store[provider] = result;
    writeStore(store);
  }

  private assertProvider(provider: string): void {
    if (!OAuthManager.PROVIDERS.includes(provider as never)) {
      throw new Error(
        `Unknown provider: "${provider}". ` +
        `Supported: ${OAuthManager.PROVIDERS.join(', ')}`
      );
    }
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

/** Shared singleton instance for use across the CLI. */
export const oauthManager = new OAuthManager();

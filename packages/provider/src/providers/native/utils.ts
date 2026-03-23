/**
 * Shared utilities for native HTTP provider implementations.
 * Used by all providers that make direct HTTP calls to upstream AI backends.
 */

import { createHash, randomUUID } from 'crypto';

// ── SSE parsing ───────────────────────────────────────────────────────────────

/**
 * Parse a Server-Sent Events response stream into data lines.
 * Yields each JSON data line (after the "data:" prefix), excluding [DONE].
 */
export async function* parseSSELines(response: Response): AsyncGenerator<string> {
  if (!response.body) throw new Error('No response body');
  const reader = response.body.getReader();
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
        if (trimmed.startsWith('data:')) {
          const data = trimmed.slice(5).trim();
          if (data && data !== '[DONE]') yield data;
        }
      }
    }
    // Flush remaining buffer
    if (buffer.trim().startsWith('data:')) {
      const data = buffer.trim().slice(5).trim();
      if (data && data !== '[DONE]') yield data;
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Browser header spoofing ───────────────────────────────────────────────────

export const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

// ── Token cache with TTL ──────────────────────────────────────────────────────

export class TokenCache {
  private readonly cache = new Map<string, { value: string; expires: number }>();

  get(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: string, ttlSeconds: number): void {
    this.cache.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }
}

// ── Crypto helpers ────────────────────────────────────────────────────────────

export function md5(data: string): string {
  return createHash('md5').update(data).digest('hex');
}

export function uuid(): string {
  return randomUUID();
}

// ── Retry fetch ───────────────────────────────────────────────────────────────

export async function retryFetch(
  url: string,
  init: RequestInit,
  maxRetries = 2,
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const res = await fetch(url, init);
      return res;
    } catch (err) {
      lastErr = err;
      if (i < maxRetries) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

// ── Message type (subset, avoids circular dependency) ────────────────────────

export interface NativeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

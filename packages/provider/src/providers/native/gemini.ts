/**
 * Native Gemini provider — cookie-based access to gemini.google.com.
 * Auth: GEMINI_COOKIE env var = "__Secure-1PSID=...;__Secure-1PSIDTS=..." (set by auth automator).
 * Flow:
 *   1. GET gemini.google.com/app → extract SNlM0e token from HTML
 *   2. POST /_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate
 */

import { BROWSER_HEADERS, TokenCache, type NativeMessage } from './utils.js';

const BASE = 'https://gemini.google.com';
const STREAM_URL = `${BASE}/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate`;

const snlmCache = new TokenCache();

const GEMINI_HEADERS = (cookie: string): Record<string, string> => ({
  ...BROWSER_HEADERS,
  Cookie: cookie,
  Referer: `${BASE}/`,
  Origin: BASE,
  'Accept-Language': 'en-US,en;q=0.9',
});

async function getSNlM0e(cookie: string): Promise<string> {
  const cacheKey = `snlm:${cookie.slice(0, 40)}`;
  const cached = snlmCache.get(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${BASE}/app`, {
    headers: { ...GEMINI_HEADERS(cookie), Accept: 'text/html' },
  });

  if (!res.ok) throw new Error(`Gemini page fetch HTTP ${res.status} — check GEMINI_COOKIE`);
  const html = await res.text();
  const match = html.match(/SNlM0e":"([^"]+)"/);
  if (!match?.[1]) throw new Error('Gemini SNlM0e token not found — session cookie may be invalid');

  snlmCache.set(cacheKey, match[1], 3500); // ~1 hour TTL
  return match[1];
}

function buildGeminiPayload(prompt: string, snlm0e: string): URLSearchParams {
  // The request uses URL-encoded form data with nested JSON
  const at = snlm0e;
  const fReqPayload = JSON.stringify([
    [
      [
        'assistant.lamda.BardFrontendService.StreamGenerate',
        JSON.stringify([[prompt], null, ['', '', '']]),
        null,
        'generic',
      ],
    ],
  ]);

  const params = new URLSearchParams({
    'bl': 'boq_assistant-bard-web-server_20240710.10_p0',
    '_reqid': String(Math.floor(Math.random() * 900000) + 100000),
    'rt': 'c',
  });

  return new URLSearchParams({
    'f.req': fReqPayload,
    'at': at,
  });
}

function parseGeminiResponse(text: string): string {
  // Gemini returns a multi-part response — extract the text content
  // Response format: a series of JSON chunks separated by newlines
  const lines = text.split('\n').filter(l => l.trim().startsWith('['));
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as unknown[][];
      // Navigate the nested structure to find text
      for (const item of parsed) {
        if (!Array.isArray(item)) continue;
        for (const inner of item) {
          if (!Array.isArray(inner)) continue;
          for (const el of inner) {
            if (typeof el === 'string' && el.length > 0) return el;
            if (Array.isArray(el)) {
              for (const sub of el) {
                if (typeof sub === 'string' && sub.length > 5) return sub;
              }
            }
          }
        }
      }
    } catch { continue; }
  }
  return '';
}

export class GeminiNativeProvider {
  readonly type = 'gemini' as const;
  readonly models = ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] as const;
  readonly defaultModel = 'gemini-2.0-flash';

  async *stream(
    messages: NativeMessage[],
    _opts?: { model?: string },
  ): AsyncGenerator<string> {
    const cookie = process.env['GEMINI_COOKIE'] ?? '';
    if (!cookie) throw new Error('GEMINI_COOKIE not set — run: spaz auth gemini');

    const snlm0e = await getSNlM0e(cookie);

    // Build prompt from message history
    const prompt = messages.map(m => {
      const role = m.role === 'user' ? 'Human' : 'Assistant';
      return `${role}: ${m.content}`;
    }).join('\n\n') + '\n\nAssistant:';

    const formData = buildGeminiPayload(prompt, snlm0e);

    const res = await fetch(`${STREAM_URL}?bl=boq_assistant-bard-web-server_20240710.10_p0&_reqid=${Math.floor(Math.random() * 900000) + 100000}&rt=c`, {
      method: 'POST',
      headers: {
        ...GEMINI_HEADERS(cookie),
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Accept: '*/*',
      },
      body: formData.toString(),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        snlmCache.delete(`snlm:${cookie.slice(0, 40)}`);
        throw new Error(`Gemini auth error ${res.status} — run: spaz auth gemini`);
      }
      throw new Error(`Gemini HTTP ${res.status}`);
    }

    const text = await res.text();
    const content = parseGeminiResponse(text);
    if (content) yield content;
  }
}

export const geminiNativeProvider = new GeminiNativeProvider();

/**
 * Native GLM provider — direct HTTP calls to chatglm.cn.
 * Pattern from LLM-Red-Team/glm-free-api:
 *   GLM_FREE_COOKIE (refresh token) → POST /v1/user/refresh → access token
 *   access token → POST /assistant/stream → SSE response
 * Auth: GLM_FREE_COOKIE env var (set by auth automator).
 */

import { parseSSELines, BROWSER_HEADERS, TokenCache, uuid, type NativeMessage } from './utils.js';

const BASE = 'https://chatglm.cn';
const REFRESH_URL = `${BASE}/chatglm/backend-api/v1/user/refresh`;
const STREAM_URL  = `${BASE}/chatglm/backend-api/assistant/stream`;

// GLM-4 default assistant ID (the main chat assistant)
const DEFAULT_ASSISTANT_ID = '65940acff94777010aa6b796';

const tokenCache = new TokenCache();

interface GLMRefreshResponse {
  result?: { accessToken: string; expiresIn: number };
  code?: number;
  message?: string;
}

interface GLMSSEEvent {
  message?: { content?: string; finish_reason?: string };
  finish_reason?: string;
  error?: string;
}

async function getAccessToken(refreshToken: string): Promise<string> {
  const cached = tokenCache.get(refreshToken);
  if (cached) return cached;

  const res = await fetch(REFRESH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${refreshToken}`,
      'Content-Type': 'application/json',
      ...BROWSER_HEADERS,
    },
  });

  if (!res.ok) throw new Error(`GLM token refresh HTTP ${res.status}`);

  const body = await res.json() as GLMRefreshResponse;
  if (!body.result?.accessToken) {
    throw new Error(`GLM token refresh failed: ${body.message ?? JSON.stringify(body)}`);
  }

  const { accessToken, expiresIn } = body.result;
  tokenCache.set(refreshToken, accessToken, Math.max(expiresIn - 60, 30));
  return accessToken;
}

export class GLMNativeProvider {
  readonly type = 'glm' as const;
  readonly models = ['glm-4-flash', 'glm-4', 'glm-4-plus', 'glm-4-think', 'glm-4-zero'] as const;
  readonly defaultModel = 'glm-4-flash';

  async *stream(
    messages: NativeMessage[],
    opts?: { model?: string },
  ): AsyncGenerator<string> {
    const refreshToken = process.env['GLM_FREE_COOKIE'] ?? '';
    if (!refreshToken) throw new Error('GLM_FREE_COOKIE not set — run: spaz auth chatglm');

    const accessToken = await getAccessToken(refreshToken);
    const model = opts?.model ?? this.defaultModel;

    const res = await fetch(STREAM_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'App-Name': 'chatglm',
        'Platform': 'pc',
        'Version': '0.0.1',
        'X-Device-Id': uuid(),
        'X-Request-Id': uuid(),
        'Origin': BASE,
        'Referer': `${BASE}/main/alltoolsdetail`,
        ...BROWSER_HEADERS,
      },
      body: JSON.stringify({
        assistant_id: DEFAULT_ASSISTANT_ID,
        conversation_id: uuid(),
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        meta_data: {
          channel: '',
          draft_id: '',
          if_plus_model: model.includes('plus') || model.includes('think'),
          input_question_type: 'xxxx',
          is_test: false,
          platform: 'pc',
          quote_log_id: '',
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // Invalidate cached token on auth error
      if (res.status === 401) tokenCache.delete(refreshToken);
      throw new Error(`GLM HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    for await (const line of parseSSELines(res)) {
      try {
        const data = JSON.parse(line) as GLMSSEEvent;
        if (data.error) throw new Error(`GLM error: ${data.error}`);
        const content = data.message?.content ?? '';
        if (content) yield content;
        if (data.finish_reason === 'stop' || data.message?.finish_reason === 'stop') break;
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
}

export const glmNativeProvider = new GLMNativeProvider();

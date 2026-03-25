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
const DELETE_URL  = `${BASE}/chatglm/backend-api/assistant/conversation/delete`;

// GLM-4 default assistant ID (the main chat assistant)
const DEFAULT_ASSISTANT_ID = '65940acff94777010aa6b796';
// Reasoning model assistant ID (glm-4-think / glm-4-zero)
const ZERO_ASSISTANT_ID = '676411c38945bbc58a905d31';

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

/**
 * Prepare messages for the GLM API.
 * Single message: pass as-is in the API's content array format.
 * Multi-turn: merge into a single user message using GLM's special tokens,
 * matching the vendor's messagesPrepare() logic.
 */
function prepareGLMMessages(messages: NativeMessage[]): Array<{ role: string; content: Array<{ type: string; text: string }> }> {
  if (messages.length <= 1) {
    return messages.map(m => ({
      role: 'user',
      content: [{ type: 'text', text: m.content }],
    }));
  }

  // Check if the latest message has file/image content (plain text only here)
  const merged = (
    messages.map(m => {
      const role = m.role
        .replace('system', '<|sytstem|>')
        .replace('assistant', '<|assistant|>')
        .replace('user', '<|user|>');
      return `${role}\n${m.content}`;
    }).join('\n') + '\n<|assistant|>'
  )
    // Remove MD image URLs to prevent hallucination
    .replace(/!\[.+?\]\(.+?\)/g, '')
    // Remove temp paths
    .replace(/\/mnt\/data\/.+/g, '');

  return [{ role: 'user', content: [{ type: 'text', text: merged }] }];
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

    // Select assistant ID: reasoning models (think/zero) use ZERO_ASSISTANT_ID.
    // Raw 24-char hex IDs are passed through directly as custom agent IDs.
    let assistantId = DEFAULT_ASSISTANT_ID;
    if (/^[a-z0-9]{24,}$/.test(model)) {
      assistantId = model;
    } else if (model.includes('think') || model.includes('zero')) {
      assistantId = ZERO_ASSISTANT_ID;
    }

    const referer = assistantId === DEFAULT_ASSISTANT_ID
      ? `${BASE}/main/alltoolsdetail`
      : `${BASE}/main/gdetail/${assistantId}`;

    // Multi-turn: merge messages into a single user message using GLM's
    // <|user|>/<|assistant|>/<|sytstem|> token format (matches vendor logic).
    const preparedMessages = prepareGLMMessages(messages);

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
        'Referer': referer,
        ...BROWSER_HEADERS,
      },
      body: JSON.stringify({
        assistant_id: assistantId,
        conversation_id: '',
        messages: preparedMessages,
        meta_data: {
          channel: '',
          draft_id: '',
          if_plus_model: true,
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

    let convId = '';

    for await (const line of parseSSELines(res)) {
      try {
        const data = JSON.parse(line) as GLMSSEEvent;
        if (data.error) throw new Error(`GLM error: ${data.error}`);

        // Capture conversation ID for cleanup
        if (!convId && (data as unknown as { conversation_id?: string }).conversation_id) {
          convId = (data as unknown as { conversation_id: string }).conversation_id;
        }

        const content = data.message?.content ?? '';
        if (content) yield content;
        if (data.finish_reason === 'stop' || data.message?.finish_reason === 'stop') break;
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }

    // Cleanup conversation (fire and forget)
    if (convId) {
      const token = await getAccessToken(refreshToken).catch(() => null);
      if (token) {
        void fetch(DELETE_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'App-Name': 'chatglm',
            'Platform': 'pc',
            'Version': '0.0.1',
            'X-Device-Id': uuid(),
            'X-Request-Id': uuid(),
            'Origin': BASE,
            'Referer': referer,
            ...BROWSER_HEADERS,
          },
          body: JSON.stringify({ assistant_id: assistantId, conversation_id: convId }),
        }).catch(() => {});
      }
    }
  }
}

export const glmNativeProvider = new GLMNativeProvider();

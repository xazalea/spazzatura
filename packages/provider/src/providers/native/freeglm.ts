/**
 * Native FreeGLM provider — direct calls to v8.qqslyx.com.
 * No auth required — free public GLM endpoint.
 * OpenAI-compatible SSE streaming.
 */

import { parseSSELines, BROWSER_HEADERS, type NativeMessage } from './utils.js';

const BASE_URL = 'https://v8.qqslyx.com';

interface OpenAIDelta {
  content?: string;
}

interface OpenAIChoice {
  delta?: OpenAIDelta;
  finish_reason?: string | null;
}

interface OpenAISSEChunk {
  choices?: OpenAIChoice[];
}

export class FreeGLMNativeProvider {
  readonly type = 'freeglm' as const;
  readonly models = ['glm-4-flash', 'glm-4-air', 'glm-4', 'glm-4-airx'] as const;
  readonly defaultModel = 'glm-4-flash';

  async *stream(
    messages: NativeMessage[],
    opts?: { model?: string },
  ): AsyncGenerator<string> {
    const model = opts?.model ?? this.defaultModel;

    const res = await fetch(`${BASE_URL}/api/openai/v1/chat/completions`, {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Origin: BASE_URL,
        Referer: `${BASE_URL}/`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`FreeGLM HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    for await (const line of parseSSELines(res)) {
      try {
        const data = JSON.parse(line) as OpenAISSEChunk;
        const delta = data.choices?.[0]?.delta?.content;
        if (delta) yield delta;
        if (data.choices?.[0]?.finish_reason === 'stop') break;
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
}

export const freeglmNativeProvider = new FreeGLMNativeProvider();

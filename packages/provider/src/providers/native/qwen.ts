/**
 * Native Qwen provider — direct HTTP calls to qianwen.biz.aliyun.com.
 * Auth: QWEN_COOKIE env var = tongyi_sso_ticket value (set by auth automator).
 * Streaming: SSE with cumulative content (delta extracted by comparing lengths).
 */

import { parseSSELines, BROWSER_HEADERS, uuid, type NativeMessage } from './utils.js';

const BASE_URL = 'https://qianwen.biz.aliyun.com';

const QWEN_HEADERS = (ticket: string): Record<string, string> => ({
  ...BROWSER_HEADERS,
  'Cookie': `tongyi_sso_ticket=${ticket}; _samesite_flag_=true`,
  'Content-Type': 'application/json',
  'Accept': 'text/event-stream',
  'Origin': 'https://tongyi.aliyun.com',
  'Referer': 'https://tongyi.aliyun.com/',
  'X-Platform': 'pc_tongyi',
  'X-Xsrf-Token': '13e5af53-4f0b-4f4d-8f5f-d578b2f70e8a',
});

interface QwenSSEEvent {
  contents?: Array<{ content: string; contentType: string; role?: string }>;
  msgStatus?: string;
  errorCode?: string;
  errorMsg?: string;
  sessionId?: string;
}

export class QwenNativeProvider {
  readonly type = 'qwen' as const;
  readonly models = ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-long'] as const;
  readonly defaultModel = 'qwen-turbo';

  async *stream(
    messages: NativeMessage[],
    opts?: { model?: string },
  ): AsyncGenerator<string> {
    const ticket = process.env['QWEN_COOKIE'] ?? '';
    if (!ticket) throw new Error('QWEN_COOKIE not set — run: spaz auth qwen');

    const sessionId = uuid();
    const parentMsgId = uuid();

    const contents = messages.map(m => ({
      content: m.content,
      contentType: 'text',
      role: m.role === 'user' ? 'user' : 'assistant',
    }));

    const res = await fetch(`${BASE_URL}/dialog/conversation`, {
      method: 'POST',
      headers: QWEN_HEADERS(ticket),
      body: JSON.stringify({
        mode: 'chat',
        model: opts?.model ?? this.defaultModel,
        action: 'next',
        userAction: 'chat',
        requestId: uuid(),
        sessionId,
        sessionType: 'text_chat',
        parentMsgId,
        params: { fileUploadBatchId: uuid() },
        contents,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Qwen HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    let lastContent = '';

    for await (const line of parseSSELines(res)) {
      try {
        const data = JSON.parse(line) as QwenSSEEvent;
        if (data.errorCode && data.errorCode !== '0') {
          throw new Error(`Qwen error ${data.errorCode}: ${data.errorMsg ?? 'unknown'}`);
        }
        const content = data.contents?.[0]?.content ?? '';
        if (content.length > lastContent.length) {
          yield content.slice(lastContent.length);
          lastContent = content;
        }
        if (data.msgStatus === 'finished') break;
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }

    // Cleanup session (fire and forget — don't await)
    void fetch(`${BASE_URL}/dialog/session/delete`, {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS,
        'Cookie': `tongyi_sso_ticket=${ticket}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});
  }
}

export const qwenNativeProvider = new QwenNativeProvider();

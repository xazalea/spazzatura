/**
 * Native Qwen provider — direct HTTP calls to qianwen.biz.aliyun.com.
 * Auth: QWEN_COOKIE env var = tongyi_sso_ticket or login_aliyunid_ticket value
 * (set by auth automator). Tokens >100 chars are treated as login_aliyunid_ticket.
 * Streaming: SSE with cumulative content (delta extracted by comparing lengths).
 * Multi-turn: messages are merged using <|im_start|> / <|im_end|> token format.
 */

import { parseSSELines, uuid, type NativeMessage } from './utils.js';

const BASE_URL = 'https://qianwen.biz.aliyun.com';

/**
 * Generate cookie string matching vendor logic:
 * - Tokens >100 chars are login_aliyunid_ticket; shorter ones are tongyi_sso_ticket
 * - Always adds aliyun_choice=intl and _samesite_flag_=true
 * - Random t= to avoid caching
 */
function generateCookie(ticket: string): string {
  const ticketName = ticket.length > 100 ? 'login_aliyunid_ticket' : 'tongyi_sso_ticket';
  return [
    `${ticketName}=${ticket}`,
    'aliyun_choice=intl',
    '_samesite_flag_=true',
    `t=${uuid().replace(/-/g, '')}`,
  ].join('; ');
}

const FAKE_HEADERS: Record<string, string> = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  'Cache-Control': 'no-cache',
  Origin: 'https://tongyi.aliyun.com',
  Pragma: 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  Referer: 'https://tongyi.aliyun.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'X-Platform': 'pc_tongyi',
  'X-Xsrf-Token': '48b9ee49-a184-45e2-9f67-fa87213edcdc',
};

interface QwenSSEEvent {
  contents?: Array<{ content: string; contentType: string; role?: string }>;
  msgStatus?: string;
  errorCode?: string;
  errorMsg?: string;
  sessionId?: string;
  msgId?: string;
  canShare?: boolean;
}

/**
 * Prepare messages array for Qwen API.
 * Single message: pass content directly.
 * Multi-turn: merge into a single content string using <|im_start|> tokens,
 * matching the vendor's createTransStream / receiveStream logic.
 */
function prepareContents(messages: NativeMessage[]): Array<{ content: string; contentType: string; role: string }> {
  if (messages.length <= 1) {
    return messages.map(m => ({
      content: typeof m.content === 'string' ? m.content : '',
      contentType: 'text',
      role: 'user',
    }));
  }

  // Multi-turn: merge with <|im_start|>role\ncontent<|im_end|> format
  const merged = messages
    .map(m => `<|im_start|>${m.role}\n${m.content}<|im_end|>`)
    .join('\n')
    // Remove MD image URLs to avoid hallucination
    .replace(/!\[.*?\]\(.+?\)/g, '');

  return [{ content: merged, contentType: 'text', role: 'user' }];
}

export class QwenNativeProvider {
  readonly type = 'qwen' as const;
  readonly models = ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-long'] as const;
  readonly defaultModel = 'qwen-turbo';

  async *stream(
    messages: NativeMessage[],
    _opts?: { model?: string },
  ): AsyncGenerator<string> {
    const ticket = process.env['QWEN_COOKIE'] ?? '';
    if (!ticket) throw new Error('QWEN_COOKIE not set — run: spaz auth qwen');

    const sessionId = uuid();
    const parentMsgId = uuid();

    const res = await fetch(`${BASE_URL}/dialog/conversation`, {
      method: 'POST',
      headers: {
        ...FAKE_HEADERS,
        Cookie: generateCookie(ticket),
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        mode: 'chat',
        model: '',
        action: 'next',
        userAction: 'chat',
        requestId: uuid(),
        sessionId,
        sessionType: 'text_chat',
        parentMsgId,
        params: { fileUploadBatchId: uuid() },
        contents: prepareContents(messages),
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

        // Extract assistant text from contents array (ignore image/file parts)
        const text = (data.contents ?? []).reduce((str, part) => {
          if (part.contentType !== 'text' && part.contentType !== 'text2image') return str;
          if (part.role !== 'assistant' && typeof part.content !== 'string') return str;
          return str + part.content;
        }, '');

        // Strip replacement char boundary
        const exceptIdx = text.indexOf('\uFFFD');
        const chunk = text.substring(
          exceptIdx !== -1 ? Math.min(lastContent.length, exceptIdx) : lastContent.length,
          exceptIdx === -1 ? text.length : exceptIdx,
        );

        if (chunk && data.msgStatus !== 'finished') {
          yield chunk;
          lastContent = text;
        } else if (data.msgStatus === 'finished') {
          if (chunk) yield chunk;
          if (!data.canShare) yield '\n[内容由于不合规被停止生成，我们换个话题吧]';
          if (data.errorCode) yield `服务暂时不可用，第三方响应错误：${data.errorCode}`;
          break;
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }

    // Cleanup session (fire and forget — don't await)
    void fetch(`${BASE_URL}/dialog/session/delete`, {
      method: 'POST',
      headers: {
        ...FAKE_HEADERS,
        Cookie: generateCookie(ticket),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});
  }

  /**
   * Check whether the QWEN_COOKIE is valid by calling the session list endpoint.
   * Returns true if the API accepts the token.
   */
  async checkTokenLive(): Promise<boolean> {
    const ticket = process.env['QWEN_COOKIE'] ?? '';
    if (!ticket) return false;
    try {
      const res = await fetch(`${BASE_URL}/dialog/session/list`, {
        method: 'POST',
        headers: {
          ...FAKE_HEADERS,
          Cookie: generateCookie(ticket),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) return false;
      const body = await res.json() as { success?: boolean; data?: unknown };
      return body.success !== false && Array.isArray(body.data);
    } catch {
      return false;
    }
  }
}

export const qwenNativeProvider = new QwenNativeProvider();

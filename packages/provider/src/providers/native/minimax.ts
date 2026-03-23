/**
 * Native MiniMax/Hailuo provider — direct HTTP calls to hailuoai.com.
 * Pattern from LLM-Red-Team/minimax-free-api:
 *   1. Register device → get deviceId + userId
 *   2. POST /v4/api/chat/msg via HTTP/2 with FormData + MD5 Yy signature
 * Auth: MINIMAX_COOKIE env var (token from hailuoai.com, set by auth automator).
 */

import http2 from 'http2';
import { md5, TokenCache, uuid, type NativeMessage } from './utils.js';

const BASE = 'https://hailuoai.com';
const CHARACTER_ID = '1';
const SENTRY_RELEASE = 'CI7N-1MjJnx5pru-bzzhR';
const SENTRY_PUBLIC_KEY = '6cf106db5c7b7262eae7cc6b411c776a';
const DEVICE_INFO_EXPIRES = 10800;

interface DeviceInfo {
  deviceId: string;
  userId: string;
  expiresAt: number;
}

interface MinimaxSSEMessage {
  chatID?: string;
  msgID?: string;
  isEnd?: boolean;
  content?: string | Array<{ content?: string }>;
  extra?: unknown;
}

const FAKE_HEADERS: Record<string, string> = {
  Accept: '*/*',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  Origin: BASE,
  Pragma: 'no-cache',
  Priority: 'u=1, i',
  'Sec-Ch-Ua': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
};

const deviceCache = new TokenCache();

function buildQueryString(userId: string, deviceId: string | null, unix: string): string {
  const params: Record<string, string> = {
    device_platform: 'web',
    app_id: '3001',
    version_code: '22200',
    uuid: userId,
    os_name: 'Windows',
    browser_name: 'chrome',
    device_memory: '8',
    cpu_core_num: '12',
    browser_language: 'zh-CN',
    browser_platform: 'Win32',
    screen_width: '1920',
    screen_height: '1080',
    unix,
  };
  if (deviceId) params['device_id'] = deviceId;
  return Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
}

function calcYyForForm(uri: string, query: string, formFields: {
  msgContent: string; characterID: string; chatID: string; form: string;
}): string {
  const unix = String(Math.floor(Date.now() / 1000));
  const dataJson = md5(formFields.characterID)
    + md5(formFields.msgContent.replace(/(\r\n|\n|\r)/g, ''))
    + md5(formFields.chatID)
    + md5(formFields.form);
  return md5(encodeURIComponent(`${uri}?${query}`) + `_${dataJson}${md5(unix)}ooui`);
}

function calcYy(uri: string, query: string, dataJson: string): string {
  const unix = String(Math.floor(Date.now() / 1000));
  return md5(`${encodeURIComponent(`${uri}${uri.includes('?') ? '&' : '?'}${query}`)}_${dataJson}${md5(unix)}ooui`);
}

async function getDeviceInfo(token: string): Promise<DeviceInfo> {
  const cacheKey = `device:${token}`;
  const cached = deviceCache.get(cacheKey);
  if (cached) return JSON.parse(cached) as DeviceInfo;

  const userId = uuid();
  const unix = String(Date.now());
  const query = buildQueryString(userId, null, unix);
  const dataJson = JSON.stringify({ uuid: userId });
  const yy = calcYy('/v1/api/user/device/register', query, dataJson);
  const traceId = uuid().replace(/-/g, '');

  const res = await fetch(
    `${BASE}/v1/api/user/device/register?${query}`,
    {
      method: 'POST',
      headers: {
        ...FAKE_HEADERS,
        Token: token,
        'Content-Type': 'application/json',
        Referer: `${BASE}/`,
        Yy: yy,
        Baggage: `sentry-environment=production,sentry-release=${SENTRY_RELEASE},sentry-public_key=${SENTRY_PUBLIC_KEY},sentry-trace_id=${traceId},sentry-sample_rate=1,sentry-sampled=true`,
        'Sentry-Trace': `${traceId}-${traceId.substring(16)}-1`,
      },
      body: dataJson,
    },
  );

  if (!res.ok) throw new Error(`MiniMax device register HTTP ${res.status}`);
  const body = await res.json() as { statusInfo?: { code: number; message: string }; data?: { deviceIDStr: string } };
  if (body.statusInfo?.code !== 0) throw new Error(`MiniMax device register: ${body.statusInfo?.message}`);
  const deviceId = body.data?.deviceIDStr ?? '';

  const info: DeviceInfo = { deviceId, userId, expiresAt: Date.now() + DEVICE_INFO_EXPIRES * 1000 };
  deviceCache.set(cacheKey, JSON.stringify(info), DEVICE_INFO_EXPIRES);
  return info;
}

function http2StreamToSSE(session: http2.ClientHttp2Session, stream: http2.ClientHttp2Stream): AsyncGenerator<string> {
  return (async function* () {
    let buffer = '';
    try {
      for await (const chunk of stream) {
        buffer += chunk as string;
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
      if (buffer.trim().startsWith('data:')) {
        const data = buffer.trim().slice(5).trim();
        if (data && data !== '[DONE]') yield data;
      }
    } finally {
      session.close();
    }
  })();
}

export class MiniMaxNativeProvider {
  readonly type = 'minimax' as const;
  readonly models = ['hailuo', 'MiniMax-Text-01'] as const;
  readonly defaultModel = 'hailuo';

  async *stream(
    messages: NativeMessage[],
    _opts?: { model?: string },
  ): AsyncGenerator<string> {
    const token = process.env['MINIMAX_COOKIE'] ?? '';
    if (!token) throw new Error('MINIMAX_COOKIE not set — run: spaz auth minimax');

    const device = await getDeviceInfo(token);
    const unix = String(Date.now());
    const query = buildQueryString(device.userId, device.deviceId, unix);

    // Combine all messages into a single prompt (MiniMax is single-turn)
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content ?? '';
    const chatID = '0';
    const form = '';

    const boundary = `----FormBoundary${uuid().replace(/-/g, '')}`;
    const formParts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="msgContent"\r\n\r\n${lastUserMsg}`,
      `--${boundary}\r\nContent-Disposition: form-data; name="characterID"\r\n\r\n${CHARACTER_ID}`,
      `--${boundary}\r\nContent-Disposition: form-data; name="chatID"\r\n\r\n${chatID}`,
      `--${boundary}\r\nContent-Disposition: form-data; name="form"\r\n\r\n${form}`,
      `--${boundary}--`,
    ];
    const formBody = formParts.join('\r\n') + '\r\n';
    const yy = calcYyForForm('/v4/api/chat/msg', query, { msgContent: lastUserMsg, characterID: CHARACTER_ID, chatID, form });
    const traceId = uuid().replace(/-/g, '');

    // HTTP/2 streaming request
    const session = await new Promise<http2.ClientHttp2Session>((resolve, reject) => {
      const s = http2.connect(BASE);
      s.once('connect', () => resolve(s));
      s.once('error', reject);
    });

    const reqHeaders: http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader = {
      ':method': 'POST',
      ':path': `/v4/api/chat/msg?${query}`,
      ':scheme': 'https',
      'content-type': `multipart/form-data; boundary=${boundary}`,
      accept: 'text/event-stream',
      referer: `${BASE}/`,
      token,
      yy,
      baggage: `sentry-environment=production,sentry-release=${SENTRY_RELEASE},sentry-public_key=${SENTRY_PUBLIC_KEY},sentry-trace_id=${traceId},sentry-sample_rate=1,sentry-sampled=true`,
      'sentry-trace': `${traceId}-${traceId.substring(16)}-1`,
      ...Object.fromEntries(Object.entries(FAKE_HEADERS).map(([k, v]) => [k.toLowerCase(), v])),
    };

    const h2stream = session.request(reqHeaders);
    h2stream.setEncoding('utf8');
    h2stream.end(formBody);

    let convId = '';

    for await (const line of http2StreamToSSE(session, h2stream)) {
      try {
        const wrapper = JSON.parse(line) as { statusInfo?: { code: number }; data?: MinimaxSSEMessage };
        if (wrapper.statusInfo && wrapper.statusInfo.code !== 0) break;
        const msg = wrapper.data ?? (wrapper as unknown as MinimaxSSEMessage);
        if (!convId && msg.chatID) convId = msg.chatID;
        const content = Array.isArray(msg.content)
          ? msg.content.map(c => c.content ?? '').join('')
          : (msg.content ?? '');
        if (content) yield content;
        if (msg.isEnd) break;
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }

    // Cleanup conversation (fire and forget)
    if (convId) {
      void fetch(`${BASE}/v1/api/chat/history/${convId}`, {
        method: 'DELETE',
        headers: { ...FAKE_HEADERS, Token: token },
      }).catch(() => {});
    }
  }
}

export const minimaxNativeProvider = new MiniMaxNativeProvider();

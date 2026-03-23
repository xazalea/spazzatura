/**
 * Native Claude-Free provider — cookie-based access to claude.ai.
 * Auth: CLAUDE_FREE_COOKIE env var = "sessionKey=..." (set by auth automator).
 * Flow:
 *   1. GET /api/organizations → pick first org UUID
 *   2. POST /api/organizations/{org}/chat_conversations → create conv
 *   3. POST /api/append_message → SSE stream response
 *   4. DELETE conversation after done (cleanup)
 */

import { parseSSELines, BROWSER_HEADERS, uuid, type NativeMessage } from './utils.js';

const BASE = 'https://claude.ai';

const CLAUDE_HEADERS = (cookie: string): Record<string, string> => ({
  ...BROWSER_HEADERS,
  Cookie: cookie.startsWith('sessionKey=') ? cookie : `sessionKey=${cookie}`,
  'Content-Type': 'application/json',
  Accept: 'text/event-stream, text/event-stream',
  Referer: `${BASE}/chats`,
  Origin: BASE,
  DNT: '1',
  Connection: 'keep-alive',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'Accept-Language': 'en-US,en;q=0.9',
  TE: 'trailers',
});

interface ClaudeOrg {
  uuid: string;
  name?: string;
}

interface ClaudeSSEEvent {
  type?: string;
  completion?: string;
  stop?: boolean;
  stop_reason?: string;
  delta?: { type?: string; text?: string };
  index?: number;
}

let cachedOrgId: string | undefined;

async function getOrgId(headers: Record<string, string>): Promise<string> {
  if (cachedOrgId) return cachedOrgId;

  const res = await fetch(`${BASE}/api/organizations`, { headers });
  if (!res.ok) throw new Error(`Claude orgs HTTP ${res.status} — check CLAUDE_FREE_COOKIE`);
  const orgs = await res.json() as ClaudeOrg[];
  if (!orgs[0]?.uuid) throw new Error('No Claude organization found — session may be invalid');
  cachedOrgId = orgs[0].uuid;
  return cachedOrgId;
}

export class ClaudeFreeNativeProvider {
  readonly type = 'claude-free' as const;
  readonly models = ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-2.1'] as const;
  readonly defaultModel = 'claude-3-5-sonnet-20241022';

  async *stream(
    messages: NativeMessage[],
    opts?: { model?: string },
  ): AsyncGenerator<string> {
    const sessionKey = process.env['CLAUDE_FREE_COOKIE'] ?? '';
    if (!sessionKey) throw new Error('CLAUDE_FREE_COOKIE not set — run: spaz auth claude');

    const headers = CLAUDE_HEADERS(sessionKey);
    const model = opts?.model ?? this.defaultModel;

    // Get org (cached after first call)
    let orgId: string;
    try {
      orgId = await getOrgId(headers);
    } catch {
      cachedOrgId = undefined; // reset cache on error
      throw new Error('Claude auth failed — run: spaz auth claude');
    }

    // Create conversation
    const convUuid = uuid();
    const convRes = await fetch(
      `${BASE}/api/organizations/${orgId}/chat_conversations`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ uuid: convUuid, name: '' }),
      },
    );
    if (!convRes.ok) throw new Error(`Claude create conv HTTP ${convRes.status}`);

    // Stream message
    const lastMsg = messages.at(-1);
    const prompt = lastMsg?.content ?? '';

    const msgRes = await fetch(`${BASE}/api/append_message`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        organization_uuid: orgId,
        conversation_uuid: convUuid,
        text: prompt,
        completion: {
          prompt,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          model,
        },
        attachments: [],
        files: [],
      }),
    });

    if (!msgRes.ok) {
      const body = await msgRes.text().catch(() => '');
      if (msgRes.status === 401 || msgRes.status === 403) {
        cachedOrgId = undefined;
        throw new Error(`Claude auth error ${msgRes.status} — run: spaz auth claude`);
      }
      throw new Error(`Claude HTTP ${msgRes.status}: ${body.slice(0, 200)}`);
    }

    for await (const line of parseSSELines(msgRes)) {
      try {
        const data = JSON.parse(line) as ClaudeSSEEvent;
        // Old API format
        if (data.completion) yield data.completion;
        // New streaming format
        if (data.type === 'content_block_delta' && data.delta?.text) yield data.delta.text;
        // Stop conditions
        if (data.stop === true || data.stop_reason || data.type === 'message_stop') break;
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }

    // Cleanup conversation (fire and forget)
    void fetch(`${BASE}/api/organizations/${orgId}/chat_conversations/${convUuid}`, {
      method: 'DELETE',
      headers,
    }).catch(() => {});
  }
}

export const claudeFreeNativeProvider = new ClaudeFreeNativeProvider();

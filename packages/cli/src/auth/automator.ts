/**
 * Auth automator — HTTP-first, Playwright-fallback.
 *
 * Background startup mode: purely silent, no browser window ever opens.
 * Interactive CLI mode (spaz auth <service>): opens headed browser for CAPTCHA handling.
 */

import { setToken } from './token-store.js';

const AUTH_EMAIL = 'azalea.compute@gmail.com';
const AUTH_PASS  = 'azaleacompute1!';

export interface AuthResult {
  service: string;
  success: boolean;
  token?: string;
  error?: string;
}

export interface AuthReport {
  results: AuthResult[];
  successCount: number;
  failCount: number;
}

// ── Types (minimal Playwright surface) ────────────────────────────────────────

type PW_Page = {
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  fill(sel: string, val: string): Promise<void>;
  click(sel: string): Promise<void>;
  evaluate<T>(fn: (...a: unknown[]) => T, ...args: unknown[]): Promise<T>;
  context(): PW_Context;
  close(): Promise<void>;
};
type PW_Context = {
  cookies(): Promise<Array<{ name: string; value: string; domain: string }>>;
  route(pat: string | RegExp, fn: (r: PW_Route, req: PW_Req) => void): Promise<void>;
  newPage(): Promise<PW_Page>;
  close(): Promise<void>;
};
type PW_Route = { continue(): Promise<void> };
type PW_Req   = { headers(): Record<string, string> };
type PW_Browser = {
  newContext(opts?: Record<string, unknown>): Promise<PW_Context>;
  close(): Promise<void>;
};

// ── Browser launch ─────────────────────────────────────────────────────────────

async function launchBrowser(headless: boolean): Promise<PW_Browser> {
  const { chromium } = await import('playwright') as unknown as {
    chromium: { launch(opts: Record<string, unknown>): Promise<PW_Browser> }
  };
  return chromium.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });
}

// ── Cookie helpers ─────────────────────────────────────────────────────────────

function pickCookie(cookies: Array<{ name: string; value: string }>, names: string[]): string | undefined {
  for (const n of names) {
    const c = cookies.find(c => c.name === n);
    if (c?.value && c.value.length > 8) return c.value;
  }
  return undefined;
}

async function pollCookies(
  ctx: PW_Context,
  names: string[],
  timeoutMs: number,
): Promise<string | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const cookies = await ctx.cookies().catch(() => [] as Array<{ name: string; value: string; domain: string }>);
    const found = pickCookie(cookies, names);
    if (found) return found;
    await new Promise(r => setTimeout(r, 2000));
  }
  return undefined;
}

async function tryFill(page: PW_Page, emailSels: string[], passSels: string[], submitSels: string[]): Promise<void> {
  for (const s of emailSels)  { try { await page.fill(s, AUTH_EMAIL); break; } catch { /* next */ } }
  for (const s of passSels)   { try { await page.fill(s, AUTH_PASS);  break; } catch { /* next */ } }
  for (const s of submitSels) { try { await page.click(s); break; }            catch { /* next */ } }
}

// ── HTTP-based quick auth (no browser) ────────────────────────────────────────

/**
 * Try to get a token purely via HTTP (no browser).
 * Works if the service uses a simple POST /login endpoint.
 */
async function httpAuth(
  loginUrl: string,
  body: Record<string, string>,
  extractFn: (data: unknown) => string | undefined,
): Promise<string | undefined> {
  try {
    const res = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return undefined;
    const data = await res.json() as unknown;
    return extractFn(data);
  } catch {
    return undefined;
  }
}

// ── Service flows ──────────────────────────────────────────────────────────────

async function authQwen(browser: PW_Browser, timeoutMs: number): Promise<AuthResult> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  let captured: string | undefined;

  await ctx.route('**/*', async (route, req) => {
    const h = req.headers();
    const m = (h['cookie'] ?? '').match(/tongyi_sso_ticket=([^;]+)/);
    if (m?.[1] && m[1].length > 8) captured = m[1];
    await route.continue();
  });

  const page = await ctx.newPage();
  try {
    await page.goto('https://tongyi.aliyun.com/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await tryFill(
      page,
      ['input[type="email"]', 'input[placeholder*="邮箱"]', 'input[placeholder*="手机"]'],
      ['input[type="password"]', 'input[placeholder*="密码"]'],
      ['button[type="submit"]', '.login-btn'],
    );
    const token = await pollCookies(ctx, ['tongyi_sso_ticket', 'login_aliyunid_ticket'], timeoutMs) ?? captured;
    if (token) {
      setToken('qwen', { token, savedAt: Date.now() });
      process.env['QWEN_COOKIE'] = token;
      return { service: 'qwen', success: true, token };
    }
    return { service: 'qwen', success: false, error: 'timed out — run: spaz auth qwen' };
  } catch (e) {
    return { service: 'qwen', success: false, error: String(e) };
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
}

async function authChatGLM(browser: PW_Browser, timeoutMs: number): Promise<AuthResult> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  let captured: string | undefined;

  await ctx.route('**/*', async (route, req) => {
    const h = req.headers();
    const auth = h['authorization'] ?? '';
    if (auth.startsWith('Bearer ') && auth.length > 20) captured = auth.slice(7);
    const m = (h['cookie'] ?? '').match(/chatglm_refresh_token=([^;]+)/);
    if (m?.[1]) captured = m[1];
    await route.continue();
  });

  const page = await ctx.newPage();
  try {
    await page.goto('https://chatglm.cn/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    try { await page.click('button:has-text("登录"), .login-btn'); } catch { /* ignore */ }
    await new Promise(r => setTimeout(r, 1000));
    await tryFill(
      page,
      ['input[type="email"]', 'input[placeholder*="邮箱"]'],
      ['input[type="password"]', 'input[placeholder*="密码"]'],
      ['button[type="submit"]'],
    );
    const token = await pollCookies(ctx, ['chatglm_refresh_token', 'USER_TOKEN'], timeoutMs) ?? captured
      ?? await page.evaluate(() => { try { return localStorage.getItem('chatglm_refresh_token'); } catch { return null; } }).catch(() => null) ?? undefined;
    if (token) {
      setToken('chatglm', { token, savedAt: Date.now() });
      process.env['GLM_FREE_COOKIE'] = token;
      return { service: 'chatglm', success: true, token };
    }
    return { service: 'chatglm', success: false, error: 'timed out — run: spaz auth chatglm' };
  } catch (e) {
    return { service: 'chatglm', success: false, error: String(e) };
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
}

async function authMiniMax(browser: PW_Browser, timeoutMs: number): Promise<AuthResult> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  let captured: string | undefined;

  await ctx.route('**/*', async (route, req) => {
    const h = req.headers();
    const auth = h['authorization'] ?? h['token'] ?? '';
    if (auth.length > 10) captured = auth.replace(/^Bearer\s+/, '');
    await route.continue();
  });

  const page = await ctx.newPage();
  try {
    await page.goto('https://hailuoai.com/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    try { await page.click('button:has-text("登录")'); } catch { /* ignore */ }
    await tryFill(
      page,
      ['input[type="email"]', 'input[type="tel"]'],
      ['input[type="password"]'],
      ['button[type="submit"]'],
    );
    const token = await pollCookies(ctx, ['token', 'userToken', 'minimax_token'], timeoutMs) ?? captured
      ?? await page.evaluate(() => { try { return localStorage.getItem('token') ?? localStorage.getItem('userToken'); } catch { return null; } }).catch(() => null) ?? undefined;
    if (token) {
      setToken('minimax', { token, savedAt: Date.now() });
      process.env['MINIMAX_COOKIE'] = token;
      return { service: 'minimax', success: true, token };
    }
    return { service: 'minimax', success: false, error: 'timed out — run: spaz auth minimax' };
  } catch (e) {
    return { service: 'minimax', success: false, error: String(e) };
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
}

async function authGemini(browser: PW_Browser, timeoutMs: number): Promise<AuthResult> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  try {
    await page.goto('https://gemini.google.com/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    try { await page.click('a:has-text("Sign in")'); } catch { /* ignore */ }
    await tryFill(
      page,
      ['input[type="email"]'],
      ['input[type="password"]'],
      ['#identifierNext', '#passwordNext'],
    );
    const psid = await pollCookies(ctx, ['__Secure-1PSID'], timeoutMs);
    if (psid) {
      const all = await ctx.cookies().catch(() => []);
      const psidts = all.find(c => c.name === '__Secure-1PSIDTS')?.value ?? '';
      const combined = `__Secure-1PSID=${psid}${psidts ? `;__Secure-1PSIDTS=${psidts}` : ''}`;
      setToken('gemini', { cookie: combined, savedAt: Date.now() });
      process.env['GEMINI_COOKIE'] = combined;
      return { service: 'gemini', success: true, token: combined };
    }
    return { service: 'gemini', success: false, error: 'timed out — run: spaz auth gemini' };
  } catch (e) {
    return { service: 'gemini', success: false, error: String(e) };
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
}

async function authClaude(browser: PW_Browser, timeoutMs: number): Promise<AuthResult> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  try {
    await page.goto('https://claude.ai/login', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    try { await page.click('button:has-text("Continue with Google")'); } catch { /* ignore */ }
    await tryFill(
      page,
      ['input[type="email"]', 'input[name="email"]'],
      ['input[type="password"]'],
      ['#identifierNext', '#passwordNext', 'button:has-text("Continue")'],
    );
    const cookie = await pollCookies(ctx, ['sessionKey', '__Secure-next-auth.session-token'], timeoutMs);
    if (cookie) {
      setToken('claude', { cookie, savedAt: Date.now() });
      process.env['CLAUDE_FREE_COOKIE'] = cookie;
      return { service: 'claude', success: true, token: cookie };
    }
    return { service: 'claude', success: false, error: 'timed out — run: spaz auth claude' };
  } catch (e) {
    return { service: 'claude', success: false, error: String(e) };
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
}

type ServiceFn = (b: PW_Browser, t: number) => Promise<AuthResult>;

const FLOWS: Record<string, ServiceFn> = {
  qwen: authQwen,
  chatglm: authChatGLM,
  minimax: authMiniMax,
  gemini: authGemini,
  claude: authClaude,
};

/**
 * Background auth — ALWAYS headless, short timeouts, no visible browser.
 * Called automatically on startup. Silently skips anything that fails.
 */
export async function runAllAuth(
  onProgress?: (result: AuthResult) => void,
  services?: string[],
  onStart?: (service: string) => void,
): Promise<AuthReport> {
  const toRun = services ?? Object.keys(FLOWS);
  const results: AuthResult[] = [];
  let browser: PW_Browser | undefined;

  try {
    browser = await launchBrowser(true); // ALWAYS headless in background
    for (const svc of toRun) {
      onStart?.(svc);
      const fn = FLOWS[svc];
      if (!fn) { const r = { service: svc, success: false, error: 'unknown' }; results.push(r); onProgress?.(r); continue; }
      const result = await fn(browser, 20000).catch(e => ({ service: svc, success: false, error: String(e) })); // 20s per service
      results.push(result);
      onProgress?.(result);
    }
  } catch {
    // Playwright not installed — silently return
  } finally {
    await browser?.close().catch(() => {});
  }

  return { results, successCount: results.filter(r => r.success).length, failCount: results.filter(r => !r.success).length };
}

/**
 * Interactive auth — HEADED browser for CLI `spaz auth <service>`.
 * Opens a real browser window so users can handle CAPTCHAs.
 */
export async function runSingleAuth(service: string): Promise<AuthResult> {
  let browser: PW_Browser | undefined;
  try {
    browser = await launchBrowser(false); // headed for interactive
    const fn = FLOWS[service];
    if (!fn) return { service, success: false, error: `Unknown service: ${service}. Valid: ${Object.keys(FLOWS).join(', ')}` };
    return await fn(browser, 120000); // 2min timeout for interactive
  } catch (e) {
    return { service, success: false, error: String(e) };
  } finally {
    await browser?.close().catch(() => {});
  }
}

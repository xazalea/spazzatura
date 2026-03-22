/**
 * Playwright-based automated auth with Eruda injection for AI provider web services.
 *
 * Uses a HEADED browser so users can complete CAPTCHAs manually while we:
 *  - Inject Eruda DevTools for enhanced cookie/network visibility
 *  - Poll for specific cookies/tokens after login
 *  - Intercept network requests to capture auth tokens from API responses
 *  - Fall back to user-guided extraction with clear instructions
 */

import { setToken } from './token-store.js';

const AUTH_EMAIL = 'azalea.compute@gmail.com';
const AUTH_PASS = 'azaleacompute1!';

export interface AuthResult {
  service: string;
  success: boolean;
  token?: string;
  error?: string;
}

type BrowserContext = {
  cookies(url?: string): Promise<Array<{ name: string; value: string; domain: string }>>;
  newPage(): Promise<Page>;
  route(pattern: string | RegExp, handler: (route: Route, req: Request) => void): Promise<void>;
  close(): Promise<void>;
};
type Route = { continue(): Promise<void>; abort(): Promise<void> };
type Request = { url(): string; headers(): Record<string, string>; postData(): string | null };
type Page = {
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  fill(selector: string, value: string): Promise<void>;
  click(selector: string): Promise<void>;
  waitForURL(pattern: string | RegExp, opts?: Record<string, unknown>): Promise<void>;
  waitForSelector(selector: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForLoadState(state: string, opts?: Record<string, unknown>): Promise<void>;
  evaluate<T>(fn: (...args: unknown[]) => T, ...args: unknown[]): Promise<T>;
  addScriptTag(opts: Record<string, unknown>): Promise<unknown>;
  context(): BrowserContext;
  url(): string;
  close(): Promise<void>;
};
type Browser = {
  newContext(opts?: Record<string, unknown>): Promise<BrowserContext>;
  close(): Promise<void>;
};

async function launchBrowser(headless = false): Promise<Browser> {
  const { chromium } = await import('playwright') as unknown as {
    chromium: { launch(opts: Record<string, unknown>): Promise<Browser> }
  };
  return chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
    ],
  });
}

/** Inject Eruda DevTools into the page for enhanced inspection */
async function injectEruda(page: Page): Promise<void> {
  try {
    await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/eruda' });
    await page.evaluate(() => {
      try { (window as Record<string, unknown>)['eruda'] && ((window as Record<string, unknown>)['eruda'] as { init(): void }).init(); } catch { /* ignore */ }
    });
  } catch { /* CDN might fail in headless, ignore */ }
}

/**
 * Get all cookies for a page, using both Playwright context and Eruda/JS fallback
 */
async function getAllCookies(page: Page): Promise<Array<{ name: string; value: string; domain: string }>> {
  const playwrightCookies = await page.context().cookies().catch(() => []);

  // Also try to read document.cookie via JS for completeness
  try {
    const jsCookies = await page.evaluate(() => {
      return document.cookie.split(';').map(c => {
        const [name, ...rest] = c.trim().split('=');
        return { name: (name ?? '').trim(), value: rest.join('='), domain: window.location.hostname };
      });
    });
    // Merge: playwright cookies are more reliable, but JS might get httpOnly=false extras
    const allNames = new Set(playwrightCookies.map(c => c.name));
    for (const c of jsCookies) {
      if (c.name && !allNames.has(c.name)) playwrightCookies.push(c);
    }
  } catch { /* ignore */ }

  return playwrightCookies;
}

function findCookie(cookies: Array<{ name: string; value: string }>, names: string[]): string | undefined {
  for (const name of names) {
    const c = cookies.find(c => c.name === name);
    if (c?.value && c.value.length > 10) return c.value;
  }
  return undefined;
}

/** Poll for a cookie to appear within timeout, checking every 2s */
async function pollForCookie(
  page: Page,
  names: string[],
  timeoutMs = 60000,
  onTick?: (remaining: number) => void,
): Promise<string | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const cookies = await getAllCookies(page);
    const found = findCookie(cookies, names);
    if (found) return found;
    onTick?.(Math.round((deadline - Date.now()) / 1000));
    await new Promise(r => setTimeout(r, 2000));
  }
  return undefined;
}

/** Try auto-fill of email + password, ignoring failures */
async function tryAutoLogin(page: Page, emailSelectors: string[], passSelectors: string[], submitSelectors: string[]): Promise<void> {
  for (const sel of emailSelectors) {
    try { await page.fill(sel, AUTH_EMAIL); break; } catch { /* try next */ }
  }
  for (const sel of passSelectors) {
    try { await page.fill(sel, AUTH_PASS); break; } catch { /* try next */ }
  }
  for (const sel of submitSelectors) {
    try { await page.click(sel); break; } catch { /* try next */ }
  }
}

// ──────────────────────────────────────────────────────────────
// Service-specific auth flows
// ──────────────────────────────────────────────────────────────

/**
 * Authenticate to Qwen/Tongyi (tongyi.aliyun.com)
 * Needs: tongyi_sso_ticket OR login_aliyunid_ticket cookie
 * Used by: qwen-free-api (port 3045)
 */
async function authQwen(browser: Browser, onProgress?: (msg: string) => void): Promise<AuthResult> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  let capturedToken: string | undefined;

  // Intercept API requests to catch the SSO token in request headers
  await ctx.route('**/tongyi.aliyun.com/**', async (route, req) => {
    const headers = req.headers();
    const cookie = headers['cookie'] ?? '';
    const match = cookie.match(/tongyi_sso_ticket=([^;]+)/);
    if (match?.[1] && match[1].length > 10) capturedToken = match[1];
    await route.continue();
  });

  try {
    onProgress?.('Opening Tongyi/Qwen login page...');
    await page.goto('https://tongyi.aliyun.com/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await injectEruda(page);

    // Try auto-login
    await tryAutoLogin(
      page,
      ['input[type="email"]', 'input[placeholder*="邮箱"]', 'input[placeholder*="手机号"]'],
      ['input[type="password"]', 'input[placeholder*="密码"]'],
      ['button[type="submit"]', '.login-btn', 'button:has-text("登录")'],
    );

    onProgress?.('Waiting for login... (complete CAPTCHA in browser if shown, 60s timeout)');
    const token = await pollForCookie(
      page,
      ['tongyi_sso_ticket', 'login_aliyunid_ticket', 'cna'],
      60000,
    ) ?? capturedToken;

    if (token) {
      setToken('qwen', { token, savedAt: Date.now() });
      // Set env var immediately for services running now
      process.env['QWEN_COOKIE'] = token;
      onProgress?.(`✓ Got Qwen token: ${token.slice(0, 20)}...`);
      return { service: 'qwen', success: true, token };
    }

    return { service: 'qwen', success: false, error: 'Token not found after 60s. Try: spaz auth qwen' };
  } catch (e) {
    return { service: 'qwen', success: false, error: String(e) };
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
}

/**
 * Authenticate to ChatGLM/Z.AI (chatglm.cn)
 * Needs: chatglm_refresh_token cookie
 * Used by: glm-free-api (port 3046)
 */
async function authChatGLM(browser: Browser, onProgress?: (msg: string) => void): Promise<AuthResult> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  let capturedToken: string | undefined;

  // Intercept to catch token in API calls
  await ctx.route('**/chatglm.cn/**', async (route, req) => {
    const headers = req.headers();
    const auth = headers['authorization'] ?? '';
    if (auth.startsWith('Bearer ') && auth.length > 30) capturedToken = auth.slice(7);
    const cookie = headers['cookie'] ?? '';
    const match = cookie.match(/chatglm_refresh_token=([^;]+)/);
    if (match?.[1] && match[1].length > 10) capturedToken = match[1];
    await route.continue();
  });

  try {
    onProgress?.('Opening ChatGLM/Z.AI login page...');
    await page.goto('https://chatglm.cn/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await injectEruda(page);

    // Try clicking login button
    try { await page.click('button:has-text("登录"), .login-btn, a:has-text("登录")'); } catch { /* ignore */ }
    await new Promise(r => setTimeout(r, 1500));

    // Try Google OAuth or email login
    try { await page.click('button:has-text("Google"), [data-provider="google"]'); } catch { /* ignore */ }
    await tryAutoLogin(
      page,
      ['input[type="email"]', 'input[placeholder*="邮箱"]'],
      ['input[type="password"]', 'input[placeholder*="密码"]'],
      ['button[type="submit"]', '.submit-btn'],
    );

    onProgress?.('Waiting for login... (complete CAPTCHA in browser if shown, 60s timeout)');
    const token = await pollForCookie(
      page,
      ['chatglm_refresh_token', 'USER_TOKEN', 'token'],
      60000,
    ) ?? capturedToken ?? await page.evaluate(() => {
      try { return localStorage.getItem('chatglm_refresh_token') ?? null; } catch { return null; }
    }).catch(() => null) ?? undefined;

    if (token) {
      setToken('chatglm', { token, savedAt: Date.now() });
      process.env['GLM_FREE_COOKIE'] = token;
      onProgress?.(`✓ Got ChatGLM token: ${token.slice(0, 20)}...`);
      return { service: 'chatglm', success: true, token };
    }

    return { service: 'chatglm', success: false, error: 'Token not found after 60s. Try: spaz auth chatglm' };
  } catch (e) {
    return { service: 'chatglm', success: false, error: String(e) };
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
}

/**
 * Authenticate to MiniMax/Hailuo (hailuoai.com)
 * Needs: user token from API response
 * Used by: minimax-free-api (port 3047)
 */
async function authMiniMax(browser: Browser, onProgress?: (msg: string) => void): Promise<AuthResult> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  let capturedToken: string | undefined;

  // Intercept API responses to find the user token
  await ctx.route('**/hailuoai.com/**', async (route, req) => {
    const headers = req.headers();
    const auth = headers['authorization'] ?? headers['token'] ?? '';
    if (auth.length > 10) capturedToken = auth.replace(/^Bearer\s+/, '');
    // Check cookies too
    const cookie = headers['cookie'] ?? '';
    const match = cookie.match(/(?:token|userToken|auth_token)=([^;]+)/);
    if (match?.[1] && match[1].length > 10) capturedToken = match[1];
    await route.continue();
  });

  try {
    onProgress?.('Opening MiniMax/Hailuo login page...');
    await page.goto('https://hailuoai.com/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await injectEruda(page);

    try { await page.click('button:has-text("登录"), .login-btn'); } catch { /* ignore */ }
    await tryAutoLogin(
      page,
      ['input[type="email"]', 'input[type="tel"]'],
      ['input[type="password"]'],
      ['button[type="submit"]'],
    );

    onProgress?.('Waiting for login... (60s timeout)');
    const token = await pollForCookie(
      page,
      ['token', 'userToken', 'auth_token', 'minimax_token'],
      60000,
    ) ?? capturedToken ?? await page.evaluate(() => {
      try {
        return localStorage.getItem('token') ?? localStorage.getItem('userToken') ?? null;
      } catch { return null; }
    }).catch(() => null) ?? undefined;

    if (token) {
      setToken('minimax', { token, savedAt: Date.now() });
      process.env['MINIMAX_COOKIE'] = token;
      onProgress?.(`✓ Got MiniMax token: ${token.slice(0, 20)}...`);
      return { service: 'minimax', success: true, token };
    }

    return { service: 'minimax', success: false, error: 'Token not found after 60s. Try: spaz auth minimax' };
  } catch (e) {
    return { service: 'minimax', success: false, error: String(e) };
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
}

/**
 * Authenticate to Gemini (for WebAI-to-API / webai provider)
 * Needs: __Secure-1PSID and __Secure-1PSIDTS cookies from google.com
 */
async function authGemini(browser: Browser, onProgress?: (msg: string) => void): Promise<AuthResult> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  try {
    onProgress?.('Opening Google/Gemini login page...');
    await page.goto('https://gemini.google.com/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await injectEruda(page);

    // Try auto-login via Google
    try { await page.click('a:has-text("Sign in"), button:has-text("Sign in")'); } catch { /* ignore */ }
    await tryAutoLogin(
      page,
      ['input[type="email"]'],
      ['input[type="password"]'],
      ['#identifierNext', '#passwordNext', 'button:has-text("Next")'],
    );

    onProgress?.('Waiting for Gemini session cookies... (60s timeout)');
    const psid = await pollForCookie(page, ['__Secure-1PSID'], 60000);
    const psidts = (await getAllCookies(page)).find(c => c.name === '__Secure-1PSIDTS')?.value;

    if (psid) {
      const combined = `__Secure-1PSID=${psid}${psidts ? `;__Secure-1PSIDTS=${psidts}` : ''}`;
      setToken('gemini', { cookie: combined, savedAt: Date.now() });
      process.env['GEMINI_COOKIE'] = combined;
      onProgress?.(`✓ Got Gemini cookie`);
      return { service: 'gemini', success: true, token: combined };
    }

    return { service: 'gemini', success: false, error: 'Cookie not found after 60s. Try: spaz auth gemini' };
  } catch (e) {
    return { service: 'gemini', success: false, error: String(e) };
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
}

/**
 * Authenticate to Claude.ai
 * Needs: sessionKey cookie
 */
async function authClaude(browser: Browser, onProgress?: (msg: string) => void): Promise<AuthResult> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  try {
    onProgress?.('Opening Claude.ai login page...');
    await page.goto('https://claude.ai/login', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await injectEruda(page);

    try { await page.click('button:has-text("Continue with Google"), [data-provider="google"]'); } catch { /* ignore */ }
    await tryAutoLogin(
      page,
      ['input[type="email"]', 'input[name="email"]'],
      ['input[type="password"]'],
      ['#identifierNext', '#passwordNext', 'button:has-text("Continue")'],
    );

    onProgress?.('Waiting for Claude.ai session... (60s timeout)');
    const cookie = await pollForCookie(
      page,
      ['sessionKey', '__Secure-next-auth.session-token', 'CF_Authorization'],
      60000,
    );

    if (cookie) {
      setToken('claude', { cookie, savedAt: Date.now() });
      process.env['CLAUDE_FREE_COOKIE'] = cookie;
      return { service: 'claude', success: true, token: cookie };
    }

    return { service: 'claude', success: false, error: 'Session cookie not found after 60s' };
  } catch (e) {
    return { service: 'claude', success: false, error: String(e) };
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
}

export interface AuthReport {
  results: AuthResult[];
  successCount: number;
  failCount: number;
}

const SERVICE_FLOWS: Record<string, (browser: Browser, onProgress?: (msg: string) => void) => Promise<AuthResult>> = {
  qwen: authQwen,
  chatglm: authChatGLM,
  minimax: authMiniMax,
  gemini: authGemini,
  claude: authClaude,
};

/**
 * Run all auth flows with Eruda-enhanced headed browser.
 * Opens browser windows for each service — user can complete CAPTCHAs.
 */
export async function runAllAuth(
  onProgress?: (result: AuthResult) => void,
  services?: string[],
): Promise<AuthReport> {
  let browser: Browser | undefined;
  const results: AuthResult[] = [];
  const toRun = services ?? Object.keys(SERVICE_FLOWS);

  try {
    browser = await launchBrowser(false); // headed = true by default for CAPTCHA handling

    for (const service of toRun) {
      const fn = SERVICE_FLOWS[service];
      if (!fn) {
        const r: AuthResult = { service, success: false, error: `Unknown service: ${service}` };
        results.push(r);
        onProgress?.(r);
        continue;
      }
      const result = await fn(browser, msg => console.log(`  [${service}] ${msg}`));
      results.push(result);
      onProgress?.(result);
    }
  } catch (e) {
    const errMsg = 'Playwright not available: ' + String(e) + '\nInstall with: npx playwright install chromium';
    const r: AuthResult = { service: 'all', success: false, error: errMsg };
    results.push(r);
    onProgress?.(r);
  } finally {
    try { await browser?.close(); } catch { /* ignore */ }
  }

  return {
    results,
    successCount: results.filter(r => r.success).length,
    failCount: results.filter(r => !r.success).length,
  };
}

/** Run auth for a single service */
export async function runSingleAuth(service: string): Promise<AuthResult> {
  let browser: Browser | undefined;
  try {
    browser = await launchBrowser(false);
    const fn = SERVICE_FLOWS[service];
    if (!fn) return { service, success: false, error: `Unknown service: ${service}. Valid: ${Object.keys(SERVICE_FLOWS).join(', ')}` };
    return await fn(browser, msg => console.log(`  ${msg}`));
  } catch (e) {
    return { service, success: false, error: String(e) };
  } finally {
    try { await browser?.close(); } catch { /* ignore */ }
  }
}

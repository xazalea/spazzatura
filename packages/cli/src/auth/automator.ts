/**
 * Playwright-based automated auth for AI provider web services.
 * Logs in with provided credentials and extracts session tokens/cookies.
 */

import { setToken } from './token-store.js';

const AUTH_EMAIL = 'azalea.compute@gmail.com';
const AUTH_PASS = 'azaleacompute1!';

export interface AuthResult {
  service: string;
  success: boolean;
  error?: string;
}

type Browser = {
  newPage(): Promise<Page>;
  close(): Promise<void>;
};
type Page = {
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  fill(selector: string, value: string): Promise<void>;
  click(selector: string): Promise<void>;
  waitForURL(pattern: string | RegExp, opts?: Record<string, unknown>): Promise<void>;
  waitForSelector(selector: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForLoadState(state: string): Promise<void>;
  evaluate<T>(fn: () => T): Promise<T>;
  context(): {
    cookies(): Promise<Array<{ name: string; value: string; domain: string }>>;
  };
  locator(selector: string): { fill(v: string): Promise<void>; click(): Promise<void> };
  screenshot(opts: Record<string, unknown>): Promise<void>;
  close(): Promise<void>;
};

async function launchBrowser(): Promise<Browser> {
  // Dynamic import so playwright is optional at runtime
  const { chromium } = await import('playwright') as unknown as {
    chromium: { launch(opts: Record<string, unknown>): Promise<Browser> }
  };
  return chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });
}

async function getCookieValue(page: Page, names: string[]): Promise<string | undefined> {
  const cookies = await page.context().cookies();
  for (const name of names) {
    const c = cookies.find(c => c.name === name);
    if (c?.value) return c.value;
  }
  return undefined;
}

/** Authenticate to Z.AI (ChatGLM) and extract refresh token */
async function authChatGLM(browser: Browser): Promise<AuthResult> {
  const page = await browser.newPage();
  try {
    await page.goto('https://chatglm.cn/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

    // Try to click login button
    try {
      await page.click('[data-testid="login-btn"], .login-btn, button:has-text("登录"), a:has-text("登录")', );
      await page.waitForTimeout?.(2000);
    } catch { /* might already be on login page */ }

    // Try Google OAuth
    try {
      await page.click('button:has-text("Google"), [data-provider="google"], .google-login');
      await page.waitForTimeout?.(3000);
      // Google sign-in
      await page.fill('input[type="email"]', AUTH_EMAIL);
      await page.click('#identifierNext, button:has-text("Next")');
      await page.waitForTimeout?.(2000);
      await page.fill('input[type="password"]', AUTH_PASS);
      await page.click('#passwordNext, button:has-text("Next")');
      await page.waitForURL(/chatglm\.cn/, { timeout: 30000 });
    } catch {
      // Try email/phone login
      try {
        await page.fill('input[type="email"], input[placeholder*="邮箱"], input[placeholder*="email"]', AUTH_EMAIL);
        await page.fill('input[type="password"], input[placeholder*="密码"]', AUTH_PASS);
        await page.click('button[type="submit"], .submit-btn');
        await page.waitForURL(/chatglm\.cn/, { timeout: 20000 });
      } catch { /* ignore */ }
    }

    const token = await getCookieValue(page, ['chatglm_refresh_token', 'USER_TOKEN', 'token']);
    const localToken = await page.evaluate(() => {
      try { return localStorage.getItem('chatglm_refresh_token') ?? localStorage.getItem('token'); } catch { return null; }
    });
    const finalToken = token ?? localToken ?? undefined;

    if (finalToken) {
      setToken('chatglm', { token: finalToken, savedAt: Date.now() });
      return { service: 'chatglm', success: true };
    }
    return { service: 'chatglm', success: false, error: 'Could not extract token' };
  } catch (e) {
    return { service: 'chatglm', success: false, error: String(e) };
  } finally {
    await page.close();
  }
}

/** Authenticate to Claude.ai */
async function authClaude(browser: Browser): Promise<AuthResult> {
  const page = await browser.newPage();
  try {
    await page.goto('https://claude.ai/login', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

    // Try Google OAuth
    try {
      await page.click('button:has-text("Continue with Google"), [data-provider="google"]');
      await page.waitForTimeout?.(3000);
      await page.fill('input[type="email"]', AUTH_EMAIL);
      await page.click('#identifierNext, button:has-text("Next")');
      await page.waitForTimeout?.(2000);
      await page.fill('input[type="password"]', AUTH_PASS);
      await page.click('#passwordNext, button:has-text("Next")');
      await page.waitForURL(/claude\.ai/, { timeout: 30000 });
    } catch {
      // Try email login
      try {
        await page.fill('input[name="email"], input[type="email"]', AUTH_EMAIL);
        await page.click('button:has-text("Continue")');
        await page.waitForTimeout?.(5000); // magic link delay
      } catch { /* ignore */ }
    }

    const cookie = await getCookieValue(page, ['sessionKey', '__Secure-next-auth.session-token', 'CF_Authorization']);
    if (cookie) {
      setToken('claude', { cookie, savedAt: Date.now() });
      return { service: 'claude', success: true };
    }
    return { service: 'claude', success: false, error: 'Could not extract session cookie' };
  } catch (e) {
    return { service: 'claude', success: false, error: String(e) };
  } finally {
    await page.close();
  }
}

/** Authenticate to ChatGPT */
async function authChatGPT(browser: Browser): Promise<AuthResult> {
  const page = await browser.newPage();
  try {
    await page.goto('https://chat.openai.com/auth/login', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

    // Google OAuth
    try {
      await page.click('button:has-text("Continue with Google")');
      await page.waitForTimeout?.(3000);
      await page.fill('input[type="email"]', AUTH_EMAIL);
      await page.click('#identifierNext, button:has-text("Next")');
      await page.waitForTimeout?.(2000);
      await page.fill('input[type="password"]', AUTH_PASS);
      await page.click('#passwordNext, button:has-text("Next")');
      await page.waitForURL(/chat\.openai\.com/, { timeout: 30000 });
    } catch { /* ignore */ }

    const token = await getCookieValue(page, ['__Secure-next-auth.session-token', 'next-auth.session-token']);
    if (token) {
      setToken('chatgpt', { token, savedAt: Date.now() });
      return { service: 'chatgpt', success: true };
    }
    return { service: 'chatgpt', success: false, error: 'Could not extract token' };
  } catch (e) {
    return { service: 'chatgpt', success: false, error: String(e) };
  } finally {
    await page.close();
  }
}

/** Authenticate to Qwen (Tongyi) */
async function authQwen(browser: Browser): Promise<AuthResult> {
  const page = await browser.newPage();
  try {
    await page.goto('https://tongyi.aliyun.com/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

    try {
      await page.click('button:has-text("登录"), .login-btn');
      await page.waitForTimeout?.(2000);
      await page.fill('input[type="email"], input[placeholder*="邮箱"]', AUTH_EMAIL);
      await page.click('button:has-text("下一步"), button[type="submit"]');
      await page.waitForTimeout?.(1500);
      await page.fill('input[type="password"]', AUTH_PASS);
      await page.click('button[type="submit"]');
      await page.waitForURL(/tongyi\.aliyun\.com/, { timeout: 20000 });
    } catch { /* ignore */ }

    const token = await getCookieValue(page, ['cna', 'login_aliyunid_ticket', 'JSESSIONID', '_sso_sec_']);
    if (token) {
      setToken('qwen', { cookie: token, savedAt: Date.now() });
      return { service: 'qwen', success: true };
    }
    return { service: 'qwen', success: false, error: 'Could not extract cookie' };
  } catch (e) {
    return { service: 'qwen', success: false, error: String(e) };
  } finally {
    await page.close();
  }
}

/** Authenticate to MiniMax (Hailuo) */
async function authMiniMax(browser: Browser): Promise<AuthResult> {
  const page = await browser.newPage();
  try {
    await page.goto('https://hailuoai.com/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

    try {
      await page.click('button:has-text("登录"), .login-btn');
      await page.waitForTimeout?.(2000);
      await page.fill('input[type="email"]', AUTH_EMAIL);
      await page.fill('input[type="password"]', AUTH_PASS);
      await page.click('button[type="submit"]');
      await page.waitForURL(/hailuoai\.com/, { timeout: 20000 });
    } catch { /* ignore */ }

    const token = await getCookieValue(page, ['token', 'auth_token', 'userToken']);
    if (token) {
      setToken('minimax', { token, savedAt: Date.now() });
      return { service: 'minimax', success: true };
    }
    return { service: 'minimax', success: false, error: 'Could not extract token' };
  } catch (e) {
    return { service: 'minimax', success: false, error: String(e) };
  } finally {
    await page.close();
  }
}

export interface AuthReport {
  results: AuthResult[];
  successCount: number;
  failCount: number;
}

/**
 * Run all auth flows. Emits progress via callback.
 */
export async function runAllAuth(
  onProgress?: (result: AuthResult) => void
): Promise<AuthReport> {
  let browser: Browser | undefined;
  const results: AuthResult[] = [];

  try {
    browser = await launchBrowser();

    const flows = [
      { name: 'chatglm', fn: authChatGLM },
      { name: 'claude', fn: authClaude },
      { name: 'chatgpt', fn: authChatGPT },
      { name: 'qwen', fn: authQwen },
      { name: 'minimax', fn: authMiniMax },
    ];

    for (const { fn } of flows) {
      const result = await fn(browser);
      results.push(result);
      onProgress?.(result);
    }
  } catch (e) {
    // Playwright not installed — graceful degradation
    const errMsg = 'Playwright not available: ' + String(e) + '. Install with: npx playwright install chromium';
    results.push({ service: 'all', success: false, error: errMsg });
    onProgress?.({ service: 'all', success: false, error: errMsg });
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
    browser = await launchBrowser();
    switch (service) {
      case 'chatglm': return await authChatGLM(browser);
      case 'claude': return await authClaude(browser);
      case 'chatgpt': return await authChatGPT(browser);
      case 'qwen': return await authQwen(browser);
      case 'minimax': return await authMiniMax(browser);
      default: return { service, success: false, error: `Unknown service: ${service}` };
    }
  } catch (e) {
    return { service, success: false, error: String(e) };
  } finally {
    try { await browser?.close(); } catch { /* ignore */ }
  }
}

/**
 * CookieManager - manages browser session cookies for web-based providers
 *
 * Uses Playwright (headless Chromium) + eruda injection for cookie extraction.
 * Playwright is optional - if not installed, cookie acquisition falls back to
 * manual entry via a prompt.
 *
 * Stores cookies encrypted at ~/.spazzatura/cookies.json using AES-256-GCM
 * with a key derived from the machine's MAC address.
 */

import { homedir, networkInterfaces } from 'os';
import { join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CookieEntry {
  value: string;
  expiresAt?: string; // ISO-8601
}

interface CookieStore {
  [provider: string]: CookieEntry;
}

interface EncryptedStore {
  iv: string;       // hex
  tag: string;      // hex (GCM auth tag)
  data: string;     // hex (ciphertext)
}

// ---------------------------------------------------------------------------
// CookieManager
// ---------------------------------------------------------------------------

export class CookieManager {
  readonly storePath: string;
  private store: CookieStore = {};
  private loaded = false;

  constructor(storePath?: string) {
    this.storePath = storePath ?? join(homedir(), '.spazzatura', 'cookies.json');
  }

  // -------------------------------------------------------------------------
  // Key derivation
  // -------------------------------------------------------------------------

  /**
   * Derives a 32-byte AES key from the machine's MAC address using SHA-256.
   * Falls back to a constant seed if no network interfaces are found.
   */
  private getMachineKey(): Buffer {
    const interfaces = networkInterfaces();
    let macAddress = '';

    for (const ifaces of Object.values(interfaces)) {
      if (!ifaces) continue;
      for (const iface of ifaces) {
        if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
          macAddress = iface.mac;
          break;
        }
      }
      if (macAddress) break;
    }

    const seed = macAddress || 'spazzatura-fallback-seed';
    return createHash('sha256').update(seed).digest();
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  async load(): Promise<void> {
    if (!existsSync(this.storePath)) {
      this.store = {};
      this.loaded = true;
      return;
    }

    try {
      const raw = await readFile(this.storePath, 'utf-8');
      const encrypted: EncryptedStore = JSON.parse(raw) as EncryptedStore;

      const key = this.getMachineKey();
      const iv = Buffer.from(encrypted.iv, 'hex');
      const tag = Buffer.from(encrypted.tag, 'hex');
      const data = Buffer.from(encrypted.data, 'hex');

      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
      this.store = JSON.parse(decrypted.toString('utf-8')) as CookieStore;
    } catch {
      // If decryption fails (e.g. key changed), start fresh
      this.store = {};
    }

    this.loaded = true;
  }

  async save(): Promise<void> {
    const key = this.getMachineKey();
    const iv = randomBytes(12); // 96-bit IV recommended for GCM

    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const plaintext = Buffer.from(JSON.stringify(this.store), 'utf-8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    const encrypted: EncryptedStore = {
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      data: ciphertext.toString('hex'),
    };

    const dir = join(homedir(), '.spazzatura');
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(this.storePath, JSON.stringify(encrypted, null, 2), 'utf-8');
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Returns the cookie string for a provider if it exists and has not expired.
   */
  get(provider: string): string | undefined {
    const entry = this.store[provider];
    if (!entry) return undefined;

    if (entry.expiresAt) {
      const expires = new Date(entry.expiresAt);
      if (expires < new Date()) {
        delete this.store[provider];
        return undefined;
      }
    }

    return entry.value;
  }

  /**
   * Stores (or updates) the cookie for a provider.
   */
  async set(provider: string, cookie: string, expiresAt?: Date): Promise<void> {
    if (!this.loaded) await this.load();

    const entry: CookieEntry = { value: cookie };
    if (expiresAt !== undefined) {
      entry.expiresAt = expiresAt.toISOString();
    }

    this.store[provider] = entry;
    await this.save();
  }

  /**
   * Returns the cached cookie, or calls loginFn to obtain a new one.
   */
  async acquire(provider: string, loginFn: () => Promise<string>): Promise<string> {
    if (!this.loaded) await this.load();

    const cached = this.get(provider);
    if (cached) return cached;

    const cookie = await loginFn();
    await this.set(provider, cookie);
    return cookie;
  }

  /**
   * Forces a re-login regardless of the cache state.
   */
  async refresh(provider: string, loginFn: () => Promise<string>): Promise<string> {
    if (!this.loaded) await this.load();

    const cookie = await loginFn();
    await this.set(provider, cookie);
    return cookie;
  }

  /**
   * Attempts to acquire a cookie using Playwright (headless Chromium).
   * If Playwright is not installed, falls back to a manual prompt.
   *
   * The provided `url` is opened in Chromium; `extractFn` receives the page
   * object and should return the cookie string.
   */
  async acquireWithBrowser(
    provider: string,
    url: string,
    extractFn: (page: unknown) => Promise<string>
  ): Promise<string> {
    if (!this.loaded) await this.load();

    const cached = this.get(provider);
    if (cached) return cached;

    // Dynamic import – Playwright is optional
    let playwright: typeof import('playwright') | undefined;
    try {
      playwright = await import('playwright') as typeof import('playwright');
    } catch {
      // Playwright not available – fall back to manual entry
      playwright = undefined;
    }

    let cookie: string;

    if (playwright) {
      const browser = await playwright.chromium.launch({ headless: false });
      try {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(url);
        cookie = await extractFn(page);
      } finally {
        await browser.close();
      }
    } else {
      // Manual fallback: prompt via stdin
      cookie = await this.promptManual(provider);
    }

    await this.set(provider, cookie);
    return cookie;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private promptManual(provider: string): Promise<string> {
    return new Promise((resolve) => {
      process.stdout.write(
        `\nPlaywright not installed. Please paste the cookie for provider "${provider}" and press Enter:\n> `
      );
      let input = '';
      process.stdin.setEncoding('utf-8');
      process.stdin.once('data', (chunk) => {
        input = String(chunk).trim();
        resolve(input);
      });
    });
  }
}

/** Singleton instance for convenience */
export const cookieManager = new CookieManager();

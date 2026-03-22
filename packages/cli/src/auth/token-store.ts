/**
 * Encrypted token storage at ~/.spazzatura/auth.json
 * Uses AES-256-GCM with a machine-derived key.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir, hostname } from 'os';

const SPAZ_DIR = join(homedir(), '.spazzatura');
const AUTH_FILE = join(SPAZ_DIR, 'auth.json');

export interface ServiceToken {
  token?: string;
  cookie?: string;
  refreshToken?: string;
  expiresAt?: number;   // unix ms
  savedAt: number;      // unix ms
}

export type AuthStore = Record<string, ServiceToken>;

/** Derive a 32-byte key from machine identity */
function deriveKey(): Buffer {
  const machineId = hostname() + (process.env['USER'] ?? process.env['USERNAME'] ?? 'user');
  return createHash('sha256').update('spazzatura:' + machineId).digest();
}

function ensureDir(): void {
  if (!existsSync(SPAZ_DIR)) mkdirSync(SPAZ_DIR, { recursive: true });
}

/** Encrypt a JSON string */
function encrypt(plain: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/** Decrypt a base64 string */
function decrypt(data: string): string {
  const key = deriveKey();
  const buf = Buffer.from(data, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

export function loadAuthStore(): AuthStore {
  try {
    if (!existsSync(AUTH_FILE)) return {};
    const raw = readFileSync(AUTH_FILE, 'utf-8').trim();
    // Support both encrypted and plain JSON (migration)
    try {
      return JSON.parse(decrypt(raw)) as AuthStore;
    } catch {
      return JSON.parse(raw) as AuthStore;
    }
  } catch {
    return {};
  }
}

export function saveAuthStore(store: AuthStore): void {
  ensureDir();
  const json = JSON.stringify(store, null, 2);
  writeFileSync(AUTH_FILE, encrypt(json), 'utf-8');
}

export function getToken(service: string): ServiceToken | undefined {
  return loadAuthStore()[service];
}

export function setToken(service: string, token: Partial<ServiceToken>): void {
  const store = loadAuthStore();
  store[service] = { ...store[service], ...token, savedAt: Date.now() };
  saveAuthStore(store);
}

export function isTokenValid(service: string, maxAgeMs = 12 * 60 * 60 * 1000): boolean {
  const t = getToken(service);
  if (!t) return false;
  if (t.expiresAt && Date.now() > t.expiresAt) return false;
  if (Date.now() - t.savedAt > maxAgeMs) return false;
  return !!(t.token ?? t.cookie ?? t.refreshToken);
}

/** Load all stored tokens into environment variables for provider use */
export function injectTokensToEnv(): void {
  const store = loadAuthStore();
  const envMap: Record<string, string[]> = {
    'chatglm': ['GLM_FREE_COOKIE', 'GLM_COOKIE'],
    'qwen': ['QWEN_COOKIE', 'QWEN_API_KEY'],
    'claude': ['CLAUDE_FREE_COOKIE'],
    'minimax': ['MINIMAX_COOKIE', 'MINIMAX_TOKEN'],
    'chatgpt': ['CHAT2API_COOKIE'],
  };
  for (const [service, t] of Object.entries(store)) {
    const keys = envMap[service] ?? [];
    const value = t.token ?? t.cookie ?? t.refreshToken;
    if (value) {
      for (const envKey of keys) {
        if (!process.env[envKey]) process.env[envKey] = value;
      }
    }
  }
}

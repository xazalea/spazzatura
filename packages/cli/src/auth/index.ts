/**
 * Auth orchestration — ensures all providers are authenticated.
 */

export { loadAuthStore, saveAuthStore, getToken, setToken, isTokenValid, injectTokensToEnv } from './token-store.js';
export { runAllAuth, runSingleAuth } from './automator.js';
export type { AuthResult, AuthReport } from './automator.js';
export type { ServiceToken, AuthStore } from './token-store.js';

import { injectTokensToEnv } from './token-store.js';

/** Load stored tokens into env on startup */
export function initAuth(): void {
  try {
    injectTokensToEnv();
  } catch { /* never fail on startup */ }
}

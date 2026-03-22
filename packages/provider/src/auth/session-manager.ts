/**
 * SessionManager - monitors provider responses for auth failures and triggers
 * re-authentication automatically.
 *
 * Emits 'session-refreshed' events so the router can retry the original
 * request after re-auth completes.
 */

import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BackoffState {
  attempts: number;
  nextRetryAt: number;
}

// ---------------------------------------------------------------------------
// SessionManager
// ---------------------------------------------------------------------------

export class SessionManager extends EventEmitter {
  private readonly refreshFns = new Map<string, () => Promise<void>>();
  private readonly backoffStates = new Map<string, BackoffState>();

  /** Base delay in milliseconds (doubles each attempt, capped at maxDelay) */
  private readonly baseDelay = 1000;
  private readonly maxDelay = 30000;

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  /**
   * Registers a re-authentication function for a provider.
   * The function will be called automatically on 401/403 responses.
   */
  register(provider: string, refreshFn: () => Promise<void>): void {
    this.refreshFns.set(provider, refreshFn);
  }

  // -------------------------------------------------------------------------
  // Auth failure handling
  // -------------------------------------------------------------------------

  /**
   * Call this when a 401 or 403 response is received from a provider.
   * Implements exponential backoff and emits 'session-refreshed' on success.
   */
  async onAuthFailure(provider: string, statusCode: number): Promise<void> {
    if (statusCode !== 401 && statusCode !== 403) return;

    const refreshFn = this.refreshFns.get(provider);
    if (!refreshFn) return;

    // Retrieve or initialise backoff state
    let state = this.backoffStates.get(provider);
    if (!state) {
      state = { attempts: 0, nextRetryAt: 0 };
      this.backoffStates.set(provider, state);
    }

    // Respect backoff window
    const now = Date.now();
    if (now < state.nextRetryAt) {
      const waitMs = state.nextRetryAt - now;
      await this.sleep(waitMs);
    }

    state.attempts += 1;
    const delay = Math.min(this.baseDelay * Math.pow(2, state.attempts - 1), this.maxDelay);
    state.nextRetryAt = Date.now() + delay;

    try {
      await refreshFn();
      // Reset backoff on success
      this.backoffStates.delete(provider);
      this.emit('session-refreshed', provider);
    } catch (error) {
      this.emit('session-refresh-failed', provider, error);
    }
  }

  // -------------------------------------------------------------------------
  // Fetch wrapper
  // -------------------------------------------------------------------------

  /**
   * Wraps a fetch call with automatic retry on 401/403.
   * Retries once after triggering onAuthFailure.
   */
  async wrapFetch(
    provider: string,
    fetchFn: () => Promise<Response>
  ): Promise<Response> {
    const response = await fetchFn();

    if (response.status === 401 || response.status === 403) {
      await this.onAuthFailure(provider, response.status);

      // Retry once after re-auth
      return fetchFn();
    }

    return response;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/** Singleton instance for convenience */
export const sessionManager = new SessionManager();

/**
 * TUI entry point — Ink-based React terminal interface with TTE effect integration.
 *
 * Boot sequence:
 *   1. Start all vendor AI proxy services in background (non-blocking)
 *   2. Check / auto-install TTE
 *   3. Enter mount/unmount loop:
 *        render App → await TTE event → unmount Ink → play TTE → remount → repeat
 *   4. User quits → exit
 */

import type { GlobalOptions } from '../index.js';
import { checkTte, autoInstallTte, displayResponse, display } from './effects.js';
import { loadSettings } from './app.js';
import type { SharedState } from './app.js';
import { IdleTracker, launchGame, PetManager } from '@spazzatura/idle';
import { runEffect } from '@spazzatura/effects';

export interface TUIOptions {
  readonly provider?: string;
  readonly model?: string;
  readonly globalOptions?: GlobalOptions;
}

type TTEEvent =
  | { type: 'exit' }
  | { type: 'tte';      response: string; state: SharedState }
  | { type: 'tteError'; response: string; state: SharedState };

export async function startTUI(options: TUIOptions): Promise<void> {
  // ── Idle tracker — thunderstorm at 30s, virtual pet at 60s ────────────────
  const idleTracker = new IdleTracker();
  const pet = new PetManager();
  idleTracker.on('idle:30s', () => {
    void runEffect('thunderstorm', '  spazzatura  ').then(() => launchGame());
  });
  idleTracker.on('idle:60s', () => {
    void pet.spawn();
  });
  idleTracker.on('active', () => {
    pet.dismiss();
  });
  idleTracker.start();

  try {
    // ── TTE availability (fire-and-forget install if missing) ─────────────────
    const tteOk = await checkTte();
    if (!tteOk) void autoInstallTte();

    const [{ render }, { createElement }, { App }] = await Promise.all([
      import('ink'),
      import('react'),
      import('./app.js'),
    ]);

    // Shared mutable state that persists across unmount/remount cycles
    const shared: SharedState = {
      messages: [],
      provider: options.provider,
      model: options.model,
      tokens: 0,
      localEnabled: loadSettings().localEnabled,
    };

    let shouldExit = false;

    while (!shouldExit) {
      const event = await new Promise<TTEEvent>(resolve => {
        const inst = render(
          createElement(App, {
            provider: options.provider,
            model: options.model,
            globalOptions: options.globalOptions,
            initialState: { ...shared },
            onTTERequest: (response: string, updatedState: SharedState) => {
              inst.unmount();
              resolve({ type: 'tte', response, state: updatedState });
            },
            onTTEError: (errorMsg: string, updatedState: SharedState) => {
              inst.unmount();
              resolve({ type: 'tteError', response: errorMsg, state: updatedState });
            },
            onExit: () => {
              inst.unmount();
              resolve({ type: 'exit' });
            },
          })
        );
      });

      if (event.type === 'exit') {
        shouldExit = true;
        idleTracker.stop();
        pet.dismiss();
        continue;
      }

      Object.assign(shared, event.state);

      if (event.type === 'tte') {
        await displayResponse(event.response);
      } else {
        process.stdout.write('\n\x1b[31m✗ error\x1b[0m\n');
        await display(event.response, 'unstable');
        process.stdout.write('\n');
      }
    }
  } catch {
    const { startREPL } = await import('../repl.js');
    await startREPL(options.globalOptions ?? {});
  }
}
